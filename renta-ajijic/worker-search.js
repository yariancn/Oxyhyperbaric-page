/**
 * Server-side rental search for Ajijic (Cloudflare Worker).
 * Scrapes readable portals + returns scored Spanish summaries.
 */

const USD_MXN = 18;
const PREFERRED = {
  "la floresta": 35,
  floresta: 30,
  "villa nova": 35,
  villanova: 35,
  "rancho del oro": 35,
  "lago encantado": 32,
  "chula vista": 28,
  "las casitas": 26,
  "lomas de ajijic": 28,
  lomas: 18,
  pedregal: 24,
  "vista del lago": 26,
  "balcones de ajijic": 26,
  balcones: 16,
  "la cristina": 24,
  "hacienda del tepeyac": 28,
  tepeyac: 18,
  "senderos del lago": 22,
  "riberas del pilar": 20,
  riberas: 14,
  "san antonio tlayacapan": 16,
  terrazas: 18,
  "privada lago": 24,
};

const PRIVATE_RE = [
  [/\bfraccionamiento\b/i, 18],
  [/\bprivada\b/i, 16],
  [/\bcoto\b/i, 16],
  [/\bcondominio\b/i, 14],
  [/\bgated community\b/i, 16],
  [/\bgated\b/i, 10],
  [/\bacceso controlado\b/i, 14],
  [/\bseguridad\s*24/i, 14],
  [/\bvigilancia\b/i, 10],
  [/\bhoa\b/i, 8],
];

const PORTAL_LINKS = [
  ["Inmuebles24", "https://www.inmuebles24.com/casas-en-renta-en-ajijic.html"],
  ["Propiedades.com", "https://propiedades.com/ajijic-centro-chapala/casas-renta"],
  ["Vivanuncios", "https://www.vivanuncios.com.mx/s-casas-en-renta/jalisco/en+ajijic/v1c1299l1013q0p1"],
  ["Lamudi", "https://www.lamudi.com.mx/jalisco/chapala/casa/for-rent/"],
  ["Mercado Libre", "https://inmuebles.mercadolibre.com.mx/jalisco/casas/renta/ajijic/"],
  ["Trovit", "https://casas.trovit.com.mx/renta-casa-ajijic-20000-pesos"],
  ["Mitula", "https://casas.mitula.mx/casas/renta-casas-ajijic"],
  ["Nestoria", "https://www.nestoria.mx/ajijic-centro/casa/renta"],
  ["Casas y Terrenos", "https://www.casasyterrenos.com/jalisco/chapala/ajijic/casa/renta"],
  ["Ajijic Trinity", "https://www.ajijictrinity.com/rent/"],
  ["Doorvel", "https://www.doorvel.com/home/propiedades/casas/en-renta/mexico/jalisco/chapala"],
  ["FazWaz", "https://www.fazwaz.com.mx/es/propiedad-e-Inmueble-alquiler/jalisco/chapala"],
];

const UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export async function handleRentaAjijicApi(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const target = num(url.searchParams.get("objetivo"), 20000);
  const minPrice = num(url.searchParams.get("min"), 15000);
  const maxPrice = num(url.searchParams.get("max"), 28000);
  const housesOnly = url.searchParams.get("soloCasas") !== "0";
  const limit = Math.min(num(url.searchParams.get("limite"), 20), 40);

  const [trinity, cyt, web] = await Promise.all([
    safe(() => fetchTrinity()),
    safe(() => fetchCasasYTerrenos()),
    safe(() => fetchWebListings()),
  ]);

  const raw = dedupe([...(trinity || []), ...(cyt || []), ...(web || [])]);
  const ranked = rank(raw, { target, minPrice, maxPrice, housesOnly }).slice(0, limit);

  return json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: { objetivo: target, min: minPrice, max: maxPrice, soloCasas: housesOnly },
      count: ranked.length,
      sources: countBy(raw, (x) => x.source),
      results: ranked,
      portals: PORTAL_LINKS.map(([name, href]) => ({ name, url: href })),
    },
    200,
  );
}

async function safe(fn) {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function fetchTrinity() {
  const res = await fetch("https://www.ajijictrinity.com/rent/", {
    headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  // Houzez a veces emite atributos sin comillas (href=https://...).
  const blocks = html.split(/class=["']?item-wrap/i).slice(1);
  const out = [];
  const seen = new Set();
  for (const block of blocks) {
    const chunk = block.slice(0, 8000);
    const urlMatch = chunk.match(
      /href=["']?(https:\/\/www\.ajijictrinity\.com\/property\/[a-z0-9/_-]+)/i,
    );
    if (!urlMatch) continue;
    const url = urlMatch[1].replace(/\/?$/, "/");
    if (seen.has(url)) continue;
    seen.add(url);

    const titles = [...chunk.matchAll(
      /href=["']?https:\/\/www\.ajijictrinity\.com\/property\/[a-z0-9/_-]+["']?[^>]*>([^<]{2,90})</gi,
    )]
      .map((m) => decode(m[1]).trim())
      .filter((t) => t && !t.startsWith("$") && !/^(for rent|rented|whatsapp)$/i.test(t));
    const title = titles[0] || slugTitle(url);
    const priceText = (chunk.match(/\$\s*[\d,]+\s*\/?\s*(?:MXN|USD)/i) || [])[0] || "";
    const price = parsePrice(priceText);
    const address = (
      (chunk.match(/class=["']?item-address[^"'>\s]*["']?[^>]*>([\s\S]*?)<\//i) || [])[1] ||
      (chunk.match(/Ajijic[^<,]{0,60}/i) || [])[0] ||
      ""
    )
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const beds = intFrom(chunk, /Beds?:\s*(\d+)/i);
    const baths = floatFrom(chunk, /Baths?:\s*([\d.]+)/i);
    let propertyType = "";
    for (const label of ["Apartment", "Studio", "Room", "Villa", "House", "Home", "Residential"]) {
      if (new RegExp(`\\b${label}\\b`, "i").test(chunk)) {
        propertyType = label;
        break;
      }
    }
    const images = extractImages(chunk, 2);
    out.push({
      title,
      url,
      priceMxn: price.mxn,
      currency: price.currency,
      source: "Ajijic Trinity",
      address: address || "Ajijic, Jalisco",
      propertyType,
      bedrooms: beds,
      bathrooms: baths,
      description: "",
      features: [],
      images,
    });
  }
  // Completar 2 fotos desde ficha (solo las primeras para no alentar la API).
  const needMore = out.filter((x) => (x.images || []).length < 2).slice(0, 10);
  await Promise.all(
    needMore.map(async (item) => {
      try {
        const extra = await fetchListingImages(item.url, 2);
        item.images = uniqueUrls([...(item.images || []), ...extra]).slice(0, 2);
      } catch {
        /* keep card image */
      }
    }),
  );
  return out;
}

async function fetchCasasYTerrenos() {
  const res = await fetch("https://www.casasyterrenos.com/jalisco/chapala/ajijic/casa/renta", {
    headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="(\/propiedad\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = `https://www.casasyterrenos.com${m[1]}`;
    if (seen.has(url)) continue;
    const text = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text.length < 20) continue;
    if (/local/i.test(text) && !/casa/i.test(text)) continue;
    seen.add(url);
    const price = parsePrice(text);
    const images = extractImages(m[2], 2);
    out.push({
      title: cleanCytTitle(text),
      url,
      priceMxn: price.mxn,
      currency: price.currency,
      source: "casasyterrenos.com",
      address: (text.match(/(Ajijic|San Juan Cosal[aá]|Chapala|Jocotepec)[^$]{0,40}/i) || ["Ajijic, Jalisco"])[0],
      propertyType: /casa/i.test(text) ? "House" : "",
      bedrooms: intFrom(text, /(\d+)\s*Rec\.?/i),
      bathrooms: floatFrom(text, /(\d+(?:\.\d+)?)\s*Baños?/i),
      description: text,
      features: [],
      images,
    });
  }
  const needMore = out.filter((x) => (x.images || []).length < 2).slice(0, 6);
  await Promise.all(
    needMore.map(async (item) => {
      try {
        const extra = await fetchListingImages(item.url, 2);
        item.images = uniqueUrls([...(item.images || []), ...extra]).slice(0, 2);
      } catch {
        /* ignore */
      }
    }),
  );
  return out;
}

async function fetchWebListings() {
  const queries = [
    "casa en renta Ajijic Jalisco 20000 pesos",
    'casa renta Ajijic "Villa Nova" OR "La Floresta" fraccionamiento',
    "site:propiedades.com casa renta Ajijic",
    "site:inmuebles24.com casa renta Ajijic",
    "site:vivanuncios.com.mx casa renta Ajijic",
  ];
  const out = [];
  for (const q of queries) {
    try {
      const res = await fetch("https://html.duckduckgo.com/html/", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Language": "es-MX,es;q=0.9",
        },
        body: `q=${encodeURIComponent(q)}&kl=mx-es`,
      });
      if (!res.ok) continue;
      const html = await res.text();
      for (const m of html.matchAll(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\//gi,
      )) {
        let href = decode(m[1]);
        const uddg = href.match(/uddg=([^&]+)/);
        if (uddg) href = decodeURIComponent(uddg[1]);
        const title = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        const body = decode(m[3].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        if (!href || !title) continue;
        if (!/ajijic|chapala/i.test(`${title} ${body} ${href}`)) continue;
        if (!/renta|rent|alquiler/i.test(`${title} ${body}`)) continue;
        if (/ajijictrinity\.com\/rent\/?$/i.test(href)) continue;
        const price = parsePrice(`${title} ${body}`);
        out.push({
          title: title.slice(0, 120),
          url: href,
          priceMxn: price.mxn,
          currency: price.currency,
          source: hostOf(href),
          address: (title + " " + body).match(/Ajijic[^.]{0,40}|Villa Nova|La Floresta|Chapala/i)?.[0] || "Ajijic, Jalisco",
          propertyType: /\bcasa\b/i.test(`${title} ${body}`) ? "House" : "",
          bedrooms: intFrom(`${title} ${body}`, /(\d+)\s*(?:rec[aá]maras?|habitaciones?|beds?)/i),
          bathrooms: floatFrom(`${title} ${body}`, /(\d+(?:\.\d+)?)\s*(?:baños?|baths?)/i),
          description: body,
          features: [],
          images: [],
        });
      }
    } catch {
      /* ignore query failures */
    }
  }
  return out;
}

function rank(listings, { target, minPrice, maxPrice, housesOnly }) {
  const ranked = [];
  for (const item of listings) {
    if (item.priceMxn == null || item.priceMxn < minPrice || item.priceMxn > maxPrice) continue;
    const ptype = norm(item.propertyType);
    const titleN = norm(item.title);
    if (/(commercial|restaurant|local|room|studio)/.test(ptype) || /restaurant|comercial/.test(titleN)) {
      continue;
    }
    if (housesOnly && /(apartment|departamento|room)/.test(ptype)) continue;
    if (looksLikeIndex(item)) continue;

    const blob = [item.title, item.address, item.propertyType, item.description, ...(item.features || [])].join(" ");
    const neighborhoods = neighborhoodHits(blob);
    const privateHits = PRIVATE_RE.filter(([re]) => re.test(norm(blob))).map(([re]) => String(re));
    let score = priceScore(item.priceMxn, target, minPrice, maxPrice);
    for (const n of neighborhoods) score += PREFERRED[n] || 0;
    let priv = 0;
    for (const [re, pts] of PRIVATE_RE) if (re.test(norm(blob))) priv += pts;
    score += Math.min(priv, 40);
    if (/(house|casa|home|villa|residential)/.test(ptype) || /\bcasa\b/.test(titleN)) score += 12;
    if (item.bedrooms >= 2) score += 6;
    if (item.bedrooms >= 3) score += 4;
    if (item.bathrooms >= 2) score += 3;
    const loc = norm(`${item.address} ${item.title} ${item.description}`);
    if (loc.includes("ajijic")) score += 15;
    else if (loc.includes("riberas")) score += 6;
    else if (/san juan cosala|jocotepec|chapala/.test(loc)) score += 2;

    const summary = summarize(item, neighborhoods, privateHits.length > 0);
    ranked.push({
      ...item,
      images: (item.images || []).slice(0, 2),
      score: Math.round(score * 10) / 10,
      neighborhoods,
      privateCommunity: privateHits.length > 0,
      summary,
    });
  }
  ranked.sort((a, b) => b.score - a.score || Math.abs(a.priceMxn - target) - Math.abs(b.priceMxn - target));
  return ranked;
}

function summarize(item, neighborhoods, isPrivate) {
  const tipo = /(house|home|residential)/i.test(item.propertyType || "")
    ? "casa"
    : /apartment|departamento/i.test(item.propertyType || "")
      ? "departamento"
      : (item.propertyType || "propiedad").toLowerCase();
  const rooms = [];
  if (item.bedrooms != null) rooms.push(`${item.bedrooms} recámara${item.bedrooms === 1 ? "" : "s"}`);
  if (item.bathrooms != null) rooms.push(`${item.bathrooms} baño${item.bathrooms === 1 ? "" : "s"}`);
  const zone = neighborhoods.length
    ? `zona media-alta (${neighborhoods.map(titleCase).join(", ")})`
    : `ubicación en ${(item.address || "Ajijic").split(",")[0]}`;
  const priv = isPrivate
    ? "parece estar en fraccionamiento/coto o con acceso controlado"
    : "no se confirma fraccionamiento privado en el anuncio";
  return `${item.title}: ${tipo} en renta por ${mxn(item.priceMxn)} mensuales, con ${
    rooms.join(", ") || "distribución no especificada"
  }. ${capitalize(zone)}; ${priv}.`;
}

async function fetchListingImages(url, limit = 2) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9" },
  });
  if (!res.ok) return [];
  return extractImages(await res.text(), limit);
}

function extractImages(html, limit = 2) {
  const found = [];
  const patterns = [
    /data-src=["']?(https?:\/\/[^"'>\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'>\s]*)?)/gi,
    /src=["']?(https?:\/\/[^"'>\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'>\s]*)?)/gi,
    /content=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)/gi,
  ];
  for (const re of patterns) {
    for (const m of String(html || "").matchAll(re)) {
      let src = m[1];
      if (!isPropertyPhoto(src)) continue;
      src = src.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))/i, "$1");
      found.push(src);
      if (found.length >= limit * 4) break;
    }
  }
  return uniqueUrls(found).slice(0, limit);
}

function isPropertyPhoto(src) {
  if (!src) return false;
  const s = src.toLowerCase();
  if (/svg\+|sprite|icon|logo|avatar|pixel|1x1|emoji|gravatar/.test(s)) return false;
  // Evitar fotos de agentes / equipo
  if (/carlos-medina|\/noe-|agent|realtor|broker|team-|headshot|profile-pic/.test(s)) return false;
  return /\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(s);
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const key = String(u || "").split("?")[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

function parsePrice(text) {
  const m = String(text || "").match(/\$?\s*([\d]{1,3}(?:,\d{3})+|\d+)\s*\/?\s*(MXN|USD|pesos?)?/i);
  if (!m) return { mxn: null, currency: "" };
  let amount = Number(m[1].replace(/,/g, ""));
  let currency = (m[2] || "MXN").toUpperCase();
  if (currency.startsWith("US")) {
    return { mxn: Math.round(amount * USD_MXN), currency: "USD" };
  }
  if (currency.includes("PESO")) currency = "MXN";
  return { mxn: amount, currency: "MXN" };
}

function priceScore(price, target, min, max) {
  if (price < min || price > max) return -100;
  const span = Math.max(target - min, max - target, 1);
  return Math.max(0, 40 * (1 - Math.abs(price - target) / span));
}

function neighborhoodHits(text) {
  const n = norm(text);
  const hits = [];
  for (const name of Object.keys(PREFERRED).sort((a, b) => b.length - a.length)) {
    if (n.includes(name) && !hits.some((h) => name.includes(h) || h.includes(name))) hits.push(name);
  }
  return hits;
}

function looksLikeIndex(item) {
  const t = norm(item.title);
  const u = (item.url || "").toLowerCase();
  if (/^\d+\s+casas?\b/.test(t)) return true;
  if (t.includes("alrededor de") && t.includes("renta")) return true;
  if (/(trovit|mitula|nestoria)/.test(u) && !/\/propiedad|\/property/.test(u)) return true;
  if (u.includes("propiedades.com") && !u.includes("/inmuebles/")) return true;
  return false;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${(item.url || "").replace(/\/$/, "").toLowerCase()}|${item.priceMxn}|${norm(item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function countBy(items, fn) {
  const o = {};
  for (const item of items) {
    const k = fn(item) || "desconocido";
    o[k] = (o[k] || 0) + 1;
  }
  return o;
}

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function slugTitle(url) {
  return url
    .replace(/\/$/, "")
    .split("/")
    .pop()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanCytTitle(text) {
  let t = text.split(/\$\s*[\d,.]+/)[0].trim().replace(/^[^,]*,\s*Jalisco\s*/i, "");
  return (t || "Casa en renta en Ajijic").slice(0, 110);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function intFrom(text, re) {
  const m = String(text).match(re);
  return m ? Number(m[1]) : null;
}

function floatFrom(text, re) {
  const m = String(text).match(re);
  return m ? Number(m[1]) : null;
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function mxn(n) {
  return n == null ? "precio N/D" : `$${Number(n).toLocaleString("es-MX")} MXN`;
}

function titleCase(s) {
  return String(s)
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120",
      ...corsHeaders(),
    },
  });
}
