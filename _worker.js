/**
 * Cloudflare Worker: static site + wellness proxy + funnel lead capture
 *
 * Env (Dashboard → Workers → oxyhyperbaric-page → Settings → Variables):
 *   WELLNESS_ORIGIN          — Vercel app for /your-wellness
 *   LEAD_WEBHOOK_URL         — optional POST URL (Zapier, Make, Slack, etc.)
 *   RESEND_API_KEY           — optional Resend API key for email alerts
 *   LEAD_NOTIFY_TO           — comma-separated emails (default: hello@oxyhyperbaric.com)
 *   TELEGRAM_BOT_TOKEN       — optional Telegram bot token
 *   TELEGRAM_CHAT_ID         — optional Telegram chat id for instant alerts
 *   TWILIO_ACCOUNT_SID       — same Twilio account as oxy-agenda (Shenandoah)
 *   TWILIO_AUTH_TOKEN        — Twilio auth token
 *   TWILIO_PHONE_NUMBER      — Twilio sender (+1...) or use TWILIO_MESSAGING_SERVICE_SID
 *   TWILIO_MESSAGING_SERVICE_SID — optional A2P messaging service (MG...)
 *   LEAD_NOTIFY_SMS_TO       — comma-separated E.164 numbers for staff SMS alerts
 *   OXY_AGENDA_FUNNEL_NOTIFY_URL — optional; default oxy-agenda funnel SMS endpoint
 *   FUNNEL_LEAD_SECRET       — shared bearer token with oxy-agenda (reuses Twilio there)
 */

const WELLNESS_PREFIX = "/your-wellness";
const LEAD_API = "/api/funnel-lead";
const DEFAULT_NOTIFY_TO = "hello@oxyhyperbaric.com";
const DEFAULT_NOTIFY_SMS_TO = "+17135913379";
const DEFAULT_OXY_AGENDA_FUNNEL_URL =
  "https://oxy-agenda.vercel.app/api/public/funnel-lead-notify";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === LEAD_API) {
      if (request.method === "OPTIONS") {
        return corsPreflight(request);
      }
      if (request.method === "POST") {
        return handleFunnelLead(request, env);
      }
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === WELLNESS_PREFIX || url.pathname.startsWith(`${WELLNESS_PREFIX}/`)) {
      const origin = env.WELLNESS_ORIGIN;
      if (!origin) {
        return new Response(
          "Your Wellness is not configured. Set WELLNESS_ORIGIN on the Worker.",
          { status: 503 },
        );
      }

      const target = new URL(url.pathname + url.search, origin.replace(/\/$/, ""));
      const proxyRequest = new Request(target.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "manual",
      });

      proxyRequest.headers.set("X-Forwarded-Host", url.host);
      proxyRequest.headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

      return fetch(proxyRequest);
    }

    return env.ASSETS.fetch(request);
  },
};

function corsPreflight(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin.endsWith("oxyhyperbaric.com") || origin.endsWith("oxyhyperbaric.marktr.co");
  if (!allowed) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleFunnelLead(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin =
    origin.endsWith("oxyhyperbaric.com") || origin.endsWith("oxyhyperbaric.marktr.co");

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.website) {
    return json({ ok: true });
  }

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 160);
  const goal = clean(body.goal, 500);
  const source = clean(body.source || "hyperbaric", 40);
  const page = clean(body.page || "", 200);

  if (!name || !phone || !email) {
    return json({ error: "Name, phone, and email are required." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email address." }, 400);
  }

  const lead = {
    name,
    phone,
    email,
    goal,
    source,
    page,
    submittedAt: new Date().toISOString(),
    ip: request.headers.get("CF-Connecting-IP") || "",
    userAgent: request.headers.get("User-Agent") || "",
    referer: request.headers.get("Referer") || "",
  };

  const errors = [];
  const tasks = [];

  if (env.LEAD_WEBHOOK_URL) {
    tasks.push(
      postWebhook(env.LEAD_WEBHOOK_URL, lead).catch((e) => {
        errors.push(`webhook: ${e.message}`);
      }),
    );
  }

  if (env.RESEND_API_KEY) {
    tasks.push(
      sendResendEmail(env, lead).catch((e) => {
        errors.push(`email: ${e.message}`);
      }),
    );
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    tasks.push(
      sendTelegram(env, lead).catch((e) => {
        errors.push(`telegram: ${e.message}`);
      }),
    );
  }

  if (isTwilioConfigured(env)) {
    tasks.push(
      sendTwilioSms(env, lead).catch((e) => {
        errors.push(`sms: ${e.message}`);
      }),
    );
  }

  if (env.FUNNEL_LEAD_SECRET) {
    tasks.push(
      notifyViaOxyAgenda(env, lead).catch((e) => {
        errors.push(`oxy-agenda: ${e.message}`);
      }),
    );
  }

  if (
    !env.LEAD_WEBHOOK_URL &&
    !env.RESEND_API_KEY &&
    !(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) &&
    !isTwilioConfigured(env) &&
    !env.FUNNEL_LEAD_SECRET
  ) {
    console.log("FUNNEL_LEAD (no notify channels configured):", JSON.stringify(lead));
    errors.push("no notify channels configured — lead logged only");
  }

  await Promise.all(tasks);

  const headers = { "Content-Type": "application/json" };
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  const notified = tasks.length > 0 && errors.length < tasks.length;
  return new Response(
    JSON.stringify({
      ok: true,
      notified,
      warnings: errors.length ? errors : undefined,
      bookingUrl: "https://oxy-agenda.vercel.app/booking/us",
    }),
    { status: 200, headers },
  );
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function postWebhook(url, lead) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "funnel_lead",
      ...lead,
      text: formatLeadText(lead),
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

async function sendResendEmail(env, lead) {
  const to = (env.LEAD_NOTIFY_TO || DEFAULT_NOTIFY_TO)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "OxyHyperbaric Leads <leads@oxyhyperbaric.com>",
      to,
      subject: `New ${lead.source} funnel lead — ${lead.name}`,
      text: formatLeadText(lead),
      html: formatLeadHtml(lead),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 120)}`);
  }
}

async function sendTelegram(env, lead) {
  const text = encodeURIComponent(`🫧 New OxyHyperbaric lead\n\n${formatLeadText(lead)}`);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${env.TELEGRAM_CHAT_ID}&text=${text}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram HTTP ${res.status}`);
  }
}

function isTwilioConfigured(env) {
  const sid = Boolean(env.TWILIO_ACCOUNT_SID);
  const token = Boolean(env.TWILIO_AUTH_TOKEN);
  const fromPhone = Boolean(env.TWILIO_PHONE_NUMBER);
  const messagingService = Boolean(String(env.TWILIO_MESSAGING_SERVICE_SID || "").trim());
  return sid && token && (fromPhone || messagingService);
}

function parseSmsRecipients(raw, defaultTo) {
  return String(raw || defaultTo)
    .split(/[,;\n]+/)
    .map((s) => toE164Us(s.trim()))
    .filter(Boolean);
}

function toE164Us(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(phone || "").trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

function normalizePhoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

async function sendTwilioSms(env, lead) {
  const recipients = parseSmsRecipients(env.LEAD_NOTIFY_SMS_TO, DEFAULT_NOTIFY_SMS_TO);
  if (!recipients.length) {
    throw new Error("No LEAD_NOTIFY_SMS_TO recipients");
  }

  const fromDigits = normalizePhoneDigits(env.TWILIO_PHONE_NUMBER);
  const body = formatLeadSms(lead);
  const messagingServiceSid = String(env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  let sent = 0;
  const failures = [];

  for (const to of recipients) {
    if (fromDigits && normalizePhoneDigits(to) === fromDigits) {
      failures.push(`${to}: same as TWILIO_PHONE_NUMBER`);
      continue;
    }

    const params = { To: to, Body: body };
    if (messagingServiceSid) {
      params.MessagingServiceSid = messagingServiceSid;
    } else {
      params.From = env.TWILIO_PHONE_NUMBER;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    if (res.ok) {
      sent += 1;
    } else {
      const detail = (await res.text()).slice(0, 120);
      failures.push(`${to}: HTTP ${res.status} ${detail}`);
    }
  }

  if (!sent) {
    throw new Error(failures.join("; ") || "Twilio send failed");
  }
}

function formatLeadSms(lead) {
  const goal = lead.goal ? ` Goal: ${lead.goal.slice(0, 80)}` : "";
  return [
    "OxyHyperbaric funnel lead — no online booking yet.",
    `${lead.name}. ${lead.phone}. ${lead.email}.${goal}`,
    "Follow up if they do not book on oxy-agenda.",
  ]
    .join(" ")
    .slice(0, 1500);
}

async function notifyViaOxyAgenda(env, lead) {
  const url = env.OXY_AGENDA_FUNNEL_NOTIFY_URL || DEFAULT_OXY_AGENDA_FUNNEL_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FUNNEL_LEAD_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(lead),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 160);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }

  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(data.error || "oxy-agenda notify failed");
  }
}

function formatLeadText(lead) {
  return [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    lead.goal ? `Goal: ${lead.goal}` : null,
    `Source: ${lead.source}`,
    lead.page ? `Page: ${lead.page}` : null,
    `Time: ${lead.submittedAt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatLeadHtml(lead) {
  const rows = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    lead.goal ? ["Goal", lead.goal] : null,
    ["Source", lead.source],
    lead.page ? ["Page", lead.page] : null,
    ["Submitted", lead.submittedAt],
  ].filter(Boolean);

  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #eee;">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#122647;"><h2>New funnel lead</h2><table style="border-collapse:collapse;">${body}</table></body></html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
