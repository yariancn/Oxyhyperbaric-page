/**
 * Server-side rental search for Ajijic (Cloudflare Worker).
 * Scrapes readable portals + returns scored Spanish summaries.
 * Incluye seed embebido: en Workers preview muchos portales se bloquean.
 */

import seedData from "./listings-seed.js";

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
  let minPrice = num(url.searchParams.get("min"), 15000);
  let maxPrice = num(url.searchParams.get("max"), 35000);
  let housesOnly = url.searchParams.get("soloCasas") === "1"; // default: todas
  const limit = Math.min(num(url.searchParams.get("limite"), 40), 60);

  const [trinity, cyt, ml, arm, web] = await Promise.all([
    safe(() => fetchTrinity()),
    safe(() => fetchCasasYTerrenos()),
    safe(() => fetchMercadoLibre()),
    safe(() => fetchAjijicRentalsMgmt()),
    safe(() => fetchWebListings()),
  ]);

  const seed = (seedData?.listings || []).map((x) => ({ ...x, fromSeed: true }));
  const live = dedupe([
    ...(trinity || []),
    ...(cyt || []),
    ...(ml || []),
    ...(arm || []),
    ...(web || []),
  ]);
  // Live primero; seed rellena portales que Cloudflare bloquea.
  const raw = dedupe([...live, ...seed]);

  let ranked = diversifyBySource(
    rank(raw, { target, minPrice, maxPrice, housesOnly }),
    limit,
  );

  // Si salen muy pocos, relajar filtros automáticamente.
  let relaxed = false;
  if (ranked.length < 12) {
    housesOnly = false;
    maxPrice = Math.max(maxPrice, 40000);
    minPrice = Math.min(minPrice, 12000);
    ranked = diversifyBySource(
      rank(raw, { target, minPrice, maxPrice, housesOnly }),
      limit,
    );
    relaxed = true;
  }

  return json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: {
        objetivo: target,
        min: minPrice,
        max: maxPrice,
        soloCasas: housesOnly,
        relaxed,
        seedUsed: seed.length,
        liveCount: live.length,
      },
      count: ranked.length,
      sources: countBy(raw, (x) => x.source),
      sourcesInResults: countBy(ranked, (x) => x.source),
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

async function fetchMercadoLibre() {
  const urls = [
    "https://inmuebles.mercadolibre.com.mx/jalisco/chapala/casas/renta/",
    "https://inmuebles.mercadolibre.com.mx/jalisco/casas/renta/_PriceRange_15000MXN-35000MXN_ITEM*LOCATION_1009791*",
  ];
  const out = [];
  const seen = new Set();
  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "es-MX,es;q=0.9",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const priceById = {};
      for (const m of html.matchAll(/"(MLM\d+)"[\s\S]{0,400}?"price"\s*:\s*(\d+)/g)) {
        priceById[m[1]] = Number(m[2]);
      }
      for (const m of html.matchAll(
        /href="(https:\/\/casa\.mercadolibre\.com\.mx\/(MLM-\d+)-([^"_#]+))/g,
      )) {
        const url = m[1].split("#")[0];
        const idDash = m[2];
        const id = idDash.replace("-", "");
        if (seen.has(id)) continue;
        seen.add(id);
        const slug = m[3].replace(/-_JM.*/, "").replace(/-/g, " ").trim();
        const priceMxn =
          priceById[id] ||
          priceById[idDash] ||
          parsePrice(slug).mxn ||
          null;
        const img =
          (html.slice(Math.max(0, m.index - 2000), m.index + 200).match(
            /https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"'\s]+/,
          ) || [])[0] || "";
        const blob = `${slug} ${url}`;
        // Chapala listing page mezcla GDL; exigir zona ribera.
        if (/san juan de dios/i.test(blob)) continue;
        const areaOk =
          /ajijic|chapala|riberas(?:\s|_|-)?del(?:\s|_|-)?pilar|floresta|lago encantado|san antonio|tlayacapan|jocotepec|cosal[aá]|san juan cosal/i.test(
            blob,
          );
        if (!areaOk) continue;
        out.push({
          title: titleCase(slug).slice(0, 120) || `Casa ML ${idDash}`,
          url,
          priceMxn,
          currency: "MXN",
          source: "Mercado Libre",
          address: /ajijic/i.test(slug) ? "Ajijic, Jalisco" : "Chapala / Ajijic, Jalisco",
          propertyType: "House",
          bedrooms: intFrom(slug, /(\d+)\s*(?:rec|recamaras|ambientes)/i),
          bathrooms: null,
          description: slug,
          features: [],
          images: img ? [img.replace(/-T\.webp/i, "-O.webp")] : [],
        });
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function fetchAjijicRentalsMgmt() {
  const res = await fetch("https://www.ajijicrentalsandmanagement.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Accept-Language": "es-MX,es;q=0.9",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"']*\/properties\/[^"']+)["']/gi)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (seen.has(url)) continue;
    seen.add(url);
    const idx = m.index;
    const chunk = html.slice(idx, idx + 1800);
    const text = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const title =
      (chunk.match(/title=["']([^"']+)["']/i) || [])[1] ||
      slugTitle(url);
    let price = parsePrice(text);
    if (price.mxn == null) {
      // USD tipo $1.800 /month
      const usd = text.match(/\$\s*([\d]+)[.,]([\d]{3})\s*\/?\s*month/i);
      if (usd) price = { mxn: Math.round(Number(usd[1] + usd[2]) * USD_MXN), currency: "USD" };
    }
    if (price.mxn == null) price = parsePrice(url.replace(/-/g, " "));
    const images = extractImages(chunk, 2);
    out.push({
      title: decode(title).replace(/\$[\d.,\s]+/g, "").trim() || slugTitle(url),
      url,
      priceMxn: price.mxn,
      currency: price.currency || "MXN",
      source: "Ajijic Rentals Mgmt",
      address: "Ajijic, Jalisco",
      propertyType: /condo|casita|apartment/i.test(url) ? "Apartment" : "House",
      bedrooms: null,
      bathrooms: null,
      description: text.slice(0, 240),
      features: [],
      images,
    });
  }
  return out;
}

async function fetchWebListings() {
  const queries = [
    "casa en renta Ajijic Jalisco 20000 OR 22000 OR 25000 MXN",
    'casa renta Ajijic "Villa Nova" OR "La Floresta" OR "Lago Encantado"',
    "site:propiedades.com/inmuebles casa renta Ajijic",
    "site:inmuebles24.com/propiedades casa renta Ajijic",
    "site:vivanuncios.com.mx casa renta Ajijic amueblada OR fraccionamiento",
    "site:lamudi.com.mx casa renta Ajijic",
    "site:icasas.mx casa renta Ajijic",
    "site:doorvel.com casa renta Ajijic",
  ];
  const out = [];
  const seen = new Set();
  for (const q of queries) {
    try {
      let res = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await fetch("https://html.duckduckgo.com/html/", {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept-Language": "es-MX,es;q=0.9",
          },
          body: `q=${encodeURIComponent(q)}&kl=mx-es`,
        });
        if (res.ok) break;
      }
      if (!res || !res.ok) continue;
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
        if (!/ajijic|chapala|riberas|floresta|villa nova/i.test(`${title} ${body} ${href}`)) continue;
        if (!/renta|rent|alquiler/i.test(`${title} ${body} ${href}`)) continue;
        if (/ajijictrinity\.com\/rent\/?$/i.test(href)) continue;
        const key = href.replace(/\/$/, "").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const price = parsePrice(`${title} ${body}`);
        const detail = isDetailListingUrl(href);
        // Sin precio solo conservamos fichas individuales (no índices de portal).
        if (price.mxn == null && !detail) continue;
        out.push({
          title: title.slice(0, 120),
          url: href,
          priceMxn: price.mxn,
          currency: price.currency,
          source: hostOf(href),
          address:
            (title + " " + body).match(
              /Ajijic[^.]{0,40}|Villa Nova|La Floresta|Lago Encantado|Chapala/i,
            )?.[0] || "Ajijic, Jalisco",
          propertyType: /\bcasa\b/i.test(`${title} ${body}`) ? "House" : "",
          bedrooms: intFrom(`${title} ${body}`, /(\d+)\s*(?:rec[aá]maras?|habitaciones?|beds?)/i),
          bathrooms: floatFrom(`${title} ${body}`, /(\d+(?:\.\d+)?)\s*(?:baños?|baths?)/i),
          description: body,
          features: [],
          images: [],
          priceUnknown: price.mxn == null,
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
    const hasPrice = item.priceMxn != null;
    if (hasPrice && (item.priceMxn < minPrice || item.priceMxn > maxPrice)) continue;
    // Sin precio: solo fichas individuales de portales (para no perder Inmuebles24/Propiedades).
    if (!hasPrice && !isDetailListingUrl(item.url)) continue;
    const ptype = norm(item.propertyType);
    const titleN = norm(item.title);
    if (/(commercial|restaurant|local|room|studio)/.test(ptype) || /restaurant|comercial/.test(titleN)) {
      continue;
    }
    if (housesOnly && /(apartment|departamento|condo|casita|room)/.test(ptype + " " + titleN + " " + (item.url || ""))) {
      continue;
    }
    if (looksLikeIndex(item)) continue;

    const blob = [item.title, item.address, item.propertyType, item.description, ...(item.features || [])].join(" ");
    const neighborhoods = neighborhoodHits(blob);
    const privateHits = PRIVATE_RE.filter(([re]) => re.test(norm(blob))).map(([re]) => String(re));
    let score = hasPrice ? priceScore(item.priceMxn, target, minPrice, maxPrice) : 8;
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
    // Empujar diversidad: no dejar que una sola fuente monopolice.
    if (!/ajijic trinity/i.test(item.source || "")) score += 10;

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
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (a.priceMxn == null) - (b.priceMxn == null) ||
      Math.abs((a.priceMxn ?? target) - target) - Math.abs((b.priceMxn ?? target) - target),
  );
  return ranked;
}

/** Round-robin por fuente para que se vean varios portales, no solo Trinity. */
function diversifyBySource(ranked, limit) {
  const buckets = new Map();
  for (const item of ranked) {
    const key = item.source || "otro";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const keys = [...buckets.keys()];
  const out = [];
  let i = 0;
  while (out.length < limit) {
    let added = false;
    for (const key of keys) {
      const bucket = buckets.get(key);
      if (i < bucket.length) {
        out.push(bucket[i]);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
    i += 1;
  }
  return out;
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
  const priceBit =
    item.priceMxn == null
      ? "precio a confirmar en el anuncio"
      : `${mxn(item.priceMxn)} mensuales`;
  return `${item.title}: ${tipo} en renta por ${priceBit}, con ${
    rooms.join(", ") || "distribución no especificada"
  }. ${capitalize(zone)}; ${priv}. Fuente: ${item.source}.`;
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
  const s = String(text || "");
  // Preferir montos con $ / MXN / pesos y separador de miles (evita "11 casas" o C.P. 45920).
  const patterns = [
    /\$\s*([\d]{1,3}(?:,\d{3})+)(?:\.\d{2})?\s*(?:\/?\s*(MXN|USD|pesos?))?/i,
    /([\d]{1,3}(?:,\d{3})+)\s*(?:MXN|pesos?)/i,
    /\$\s*([\d]{4,6})\s*(?:MXN|USD|pesos?)?/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    let amount = Number(String(m[1]).replace(/,/g, ""));
    let currency = ((m[2] || "MXN") + "").toUpperCase();
    if (currency.startsWith("US")) {
      // Si es USD pequeño tipo 1800, convertir; si ya parece MXN (>8000) dejar.
      if (amount < 8000) amount = Math.round(amount * USD_MXN);
      return { mxn: amount, currency: "USD" };
    }
    // Renta mensual razonable
    if (amount < 8000 || amount > 120000) continue;
    return { mxn: amount, currency: "MXN" };
  }
  return { mxn: null, currency: "" };
}

function isDetailListingUrl(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return false;
  if (/propiedades\.com\/inmuebles\//.test(u)) return true;
  if (/inmuebles24\.com\/propiedades\//.test(u)) return true;
  if (/casa\.mercadolibre\.com\.mx\/mlm-/.test(u)) return true;
  if (/\/properties\//.test(u)) return true;
  if (/icasas\.mx\/propiedad|doorvel\.com\/home\/propiedades|fazwaz\.com/.test(u)) return true;
  if (/vivanuncios\.com\.mx\/a-/.test(u)) return true;
  if (/lamudi\.com\.mx\/detalle|lamudi\.com\.mx\/property/.test(u)) return true;
  return false;
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
  if (/^\d+\s+(casas?|propiedades|inmuebles)\b/.test(t)) return true;
  if (t.includes("alrededor de") && t.includes("renta")) return true;
  if (/(trovit|mitula|nestoria)/.test(u) && !/\/propiedad|\/property/.test(u)) return true;
  if (u.includes("propiedades.com") && !u.includes("/inmuebles/")) return true;
  if (/inmuebles24\.com\/.+-en-renta-en-/.test(u) && !u.includes("/propiedades/")) return true;
  if (/vivanuncios\.com\.mx\/s-/.test(u)) return true;
  if (/lamudi\.com\.mx\/.+\/for-rent\/?$/.test(u)) return true;
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
