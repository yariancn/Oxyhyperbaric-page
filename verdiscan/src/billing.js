/** Stripe Checkout — $5 USD one-time unlock for VerdiScan */

const PRICE_CENTS = 500;
const PRODUCT_NAME = 'VerdiScan — acceso ilimitado';

function stripeHeaders(secret) {
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function formBody(params) {
  return new URLSearchParams(params).toString();
}

export async function createCheckoutSession(env, user, origin) {
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) return { error: 'STRIPE_NOT_CONFIGURED', status: 503 };

  const base = origin || 'https://scan.predictacore.ai';
  const params = {
    mode: 'payment',
    success_url: `${base}/?checkout=success`,
    cancel_url: `${base}/?checkout=cancel`,
    customer_email: user.email,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(PRICE_CENTS),
    'line_items[0][price_data][product_data][name]': PRODUCT_NAME,
    'line_items[0][price_data][product_data][description]':
      'Escaneos ilimitados de por vida en VerdiScan (Predictacore).',
    'metadata[product]': 'verdiscan',
    'metadata[email]': user.email,
  };

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: stripeHeaders(secret),
    body: formBody(params),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Stripe checkout error', data);
    return { error: 'STRIPE_ERROR', status: 502, detail: data.error?.message };
  }
  return { url: data.url, sessionId: data.id };
}

async function readRawBody(request) {
  const buf = await request.arrayBuffer();
  return new TextDecoder().decode(buf);
}

function parseStripeSig(header) {
  const parts = {};
  for (const bit of String(header || '').split(',')) {
    const [k, v] = bit.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  return parts;
}

async function verifyStripeWebhook(payload, sigHeader, secret) {
  const parts = parseStripeSig(sigHeader);
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (age > 300) return false;

  const signed = `${ts}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return expected === v1;
}

export async function handleStripeWebhook(request, env, markPaid) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { error: 'WEBHOOK_NOT_CONFIGURED', status: 503 };

  const payload = await readRawBody(request);
  const sig = request.headers.get('stripe-signature');
  const ok = await verifyStripeWebhook(payload, sig, secret);
  if (!ok) return { error: 'INVALID_SIGNATURE', status: 400 };

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return { error: 'INVALID_JSON', status: 400 };
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.metadata?.product === 'verdiscan' && session.metadata?.email) {
      await markPaid(session.metadata.email);
    }
  }

  return { received: true };
}
