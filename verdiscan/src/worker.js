/**
 * VerdiScan Worker — static PWA + OCR + auth + billing
 */

import {
  registerUser,
  loginUser,
  requireUser,
  deleteSession,
  publicUser,
  consumeScan,
  canScan,
  bearerToken,
  markUserPaid,
  FREE_SCANS,
} from './auth.js';
import { createCheckoutSession, handleStripeWebhook } from './billing.js';

const UA = 'VerdiScan/2.4 (https://scan.predictacore.ai)';

const OFF_FIELDS = [
  'code', 'product_name', 'product_name_es', 'product_name_en',
  'brands', 'image_url', 'image_front_url',
  'ingredients_text', 'ingredients_text_es', 'ingredients_text_en',
  'nova_group', 'nova_groups', 'additives_tags', 'additives_n',
  'nutriments', 'nutriscore_grade', 'countries_tags',
  'categories_tags', 'labels_tags',
].join(',');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
    },
  });
}

function digits(code) {
  return String(code || '').replace(/\D/g, '');
}

function pickName(p) {
  return p.product_name_es || p.product_name_en || p.product_name || p.title || 'Producto';
}

function hasIngredients(p) {
  const t = (p.ingredients_text_es || p.ingredients_text_en || p.ingredients_text || '').trim();
  return t.length >= 3;
}

async function fetchOff(base, code) {
  const res = await fetch(`${base}/${code}?fields=${OFF_FIELDS}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

async function fetchOpenProducts(code) {
  try {
    const res = await fetch(
      `https://world.openproductsfacts.org/api/v2/product/${code}?fields=${OFF_FIELDS}`,
      { headers: { Accept: 'application/json', 'User-Agent': UA } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

/** UPCitemdb trial — name/brand often present; ingredients usually not */
async function fetchUpcItemDb(code) {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return {
      code,
      product_name: item.title || item.description || 'Producto',
      brands: item.brand || '',
      image_url: item.images?.[0] || '',
      image_front_url: item.images?.[0] || '',
      ingredients_text: '',
      categories_tags: [],
      labels_tags: [],
      _verdiscan_source: 'upcitemdb',
      _verdiscan_partial: true,
    };
  } catch {
    return null;
  }
}

/** USDA FoodData Central branded foods (DEMO_KEY — rate limited, free) */
async function fetchUsda(code) {
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY` +
      `&query=${encodeURIComponent(code)}&dataType=Branded&pageSize=5`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const foods = data?.foods || [];
    const hit =
      foods.find((f) => String(f.gtinUpc || '').replace(/\D/g, '') === code) || foods[0];
    if (!hit) return null;

    const ingredients = (hit.ingredients || '').trim();
    return {
      code,
      product_name: hit.description || hit.brandOwner || 'Producto USDA',
      brands: hit.brandOwner || hit.brandName || '',
      ingredients_text: ingredients,
      ingredients_text_en: ingredients,
      categories_tags: hit.foodCategory ? [`en:${hit.foodCategory}`] : [],
      labels_tags: [],
      nutriments: {},
      _verdiscan_source: 'usda-fdc',
      _verdiscan_partial: !ingredients,
    };
  } catch {
    return null;
  }
}

async function lookupProduct(code) {
  const clean = digits(code);
  if (clean.length < 8) return { error: 'INVALID_BARCODE' };

  const sourcesTried = [];

  const offBases = [
    ['off-world', 'https://world.openfoodfacts.org/api/v2/product'],
    ['off-mx', 'https://mx.openfoodfacts.org/api/v2/product'],
    ['off-us', 'https://us.openfoodfacts.org/api/v2/product'],
  ];

  for (const [id, base] of offBases) {
    sourcesTried.push(id);
    try {
      const p = await fetchOff(base, clean);
      if (p) {
        p.code = p.code || clean;
        p.product_name = pickName(p);
        p._verdiscan_source = id;
        return { product: p, sourcesTried };
      }
    } catch {
      /* continue */
    }
  }

  sourcesTried.push('open-products');
  try {
    const p = await fetchOpenProducts(clean);
    if (p) {
      p.code = p.code || clean;
      p.product_name = pickName(p);
      p._verdiscan_source = 'open-products';
      return { product: p, sourcesTried };
    }
  } catch {
    /* continue */
  }

  // Prefer sources that may include ingredients
  sourcesTried.push('usda-fdc');
  const usda = await fetchUsda(clean);
  if (usda && hasIngredients(usda)) {
    return { product: usda, sourcesTried };
  }

  sourcesTried.push('upcitemdb');
  const upc = await fetchUpcItemDb(clean);
  if (upc) {
    // Merge USDA ingredients onto UPC name if we got a partial USDA earlier
    if (usda?.ingredients_text) {
      upc.ingredients_text = usda.ingredients_text;
      upc.ingredients_text_en = usda.ingredients_text;
      upc._verdiscan_partial = false;
      upc._verdiscan_source = 'upcitemdb+usda';
    }
    return { product: upc, sourcesTried };
  }

  if (usda) return { product: usda, sourcesTried };

  return { product: null, sourcesTried };
}

function countIngredientItems(text) {
  if (!text) return 0;
  return text
    .split(/[,;•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2).length;
}

function cleanOcrText(raw) {
  if (!raw) return { text: '', meta: {}, incomplete: true, frontOnly: false, itemCount: 0 };
  let text = String(raw)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^(here(?:'s| is)|sure[,.]?|okay[,.]?)\s*/i, '')
    .trim();

  if (
    /^NO[_\s-]*INGREDIENTS?$/i.test(text) ||
    /^FRONT[_\s-]*ONLY$/i.test(text) ||
    /^NO[_-]?$/i.test(text)
  ) {
    return {
      text: '',
      meta: {},
      incomplete: true,
      frontOnly: /^FRONT/i.test(text),
      itemCount: 0,
    };
  }

  const meta = {};
  const frontOnly = /\bFRONT[_\s-]*ONLY\b/i.test(text);
  text = text.replace(/\bFRONT[_\s-]*ONLY\b/gi, '').trim();

  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => {
      const name = l.match(/^(?:NAME|NOMBRE)\s*:\s*(.+)$/i);
      const brand = l.match(/^(?:BRAND|MARCA)\s*:\s*(.+)$/i);
      if (name) {
        meta.name = name[1].trim();
        return false;
      }
      if (brand) {
        meta.brand = brand[1].trim();
        return false;
      }
      if (/^(the (image|photo|label)|i (can|see|read)|there (is|are))/i.test(l)) return false;
      return true;
    })
    .join(' ');

  text = text
    .replace(/ingredientes?\s*[:.\-–]?\s*/gi, '')
    .replace(/ingredients?\s*[:.\-–]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .trim();

  const itemCount = countIngredientItems(text);
  const incomplete = frontOnly || itemCount < 5 || text.length < 40;

  if (!text || text.length < 3) {
    return { text: '', meta, incomplete: true, frontOnly, itemCount: 0 };
  }

  return { text, meta, incomplete, frontOnly, itemCount };
}

function stripDataUri(image) {
  const m = String(image).match(/^data:image\/[\w+]+;base64,(.+)$/i);
  return m ? m[1] : String(image).replace(/^data:image\/\w+;base64,/, '');
}

function base64ToBytes(b64) {
  const bin = atob(stripDataUri(b64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function searchOffByName(name) {
  if (!name || name.length < 4) return null;
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}` +
      `&page_size=8&fields=${OFF_FIELDS}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data.products || [];
    if (!products.length) return null;

    const needle = name.toLowerCase();
    const scored = products
      .map((p) => {
        const n = `${p.product_name || ''} ${p.brands || ''}`.toLowerCase();
        let score = 0;
        for (const word of needle.split(/\s+/)) {
          if (word.length > 2 && n.includes(word)) score += 1;
        }
        if (hasIngredients(p)) score += 3;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 2) return null;
    best.p._verdiscan_source = 'off-name-search';
    return best.p;
  } catch {
    return null;
  }
}

async function runVisionOcr(env, imageBase64) {
  const prompt =
    'You are reading a food package photo for OCR.\n' +
    'TASK: Transcribe the FULL legal ingredients list if visible (usually on the back/side in small print after Ingredients/Ingredientes).\n' +
    'Rules:\n' +
    '- Copy EVERY ingredient you can read, in order, separated by commas. Do not stop after 2-3 words.\n' +
    '- Do NOT invent ingredients from the product name or flavor (e.g. "Garlic Butter" is NOT the ingredients list).\n' +
    '- If you only see the FRONT of the pack (marketing, flavor name) and NO full ingredients panel, reply exactly: FRONT_ONLY\n' +
    '- If ingredients are partially readable, transcribe all readable parts anyway.\n' +
    'Format:\nNAME: ...\nBRAND: ...\n' +
    'then one long line of ingredients.';

  const errors = [];
  const b64 = stripDataUri(imageBase64);
  const bytes = [...base64ToBytes(b64)];
  const candidates = [];

  try {
    await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { prompt: 'agree' });
  } catch (_) {
    /* license agree best-effort */
  }

  try {
    const result = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      prompt,
      image: b64,
      max_tokens: 1200,
      temperature: 0.1,
    });
    const raw = typeof result === 'string' ? result : result?.response || '';
    if (raw && String(raw).trim()) candidates.push(String(raw));
    else errors.push('llama:empty');
  } catch (err) {
    errors.push(`llama:${err?.message || err}`);
  }

  try {
    const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: bytes,
      prompt,
      max_tokens: 1024,
    });
    const raw =
      typeof result === 'string'
        ? result
        : result?.description || result?.response || result?.result || '';
    if (raw && String(raw).trim()) candidates.push(String(raw));
    else errors.push('llava:empty');
  } catch (err) {
    errors.push(`llava:${err?.message || err}`);
  }

  try {
    const result = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
      image: `data:image/jpeg;base64,${b64}`,
      prompt,
    });
    const raw =
      typeof result === 'string'
        ? result
        : result?.answer || result?.response || result?.caption || result?.description || '';
    if (raw && String(raw).trim()) candidates.push(String(raw));
    else errors.push('moondream:empty');
  } catch (err) {
    errors.push(`moondream:${err?.message || err}`);
  }

  if (!candidates.length) {
    const e = new Error('OCR_UNAVAILABLE');
    e.details = errors;
    throw e;
  }

  const ranked = candidates
    .map((c) => ({ raw: c, cleaned: cleanOcrText(c) }))
    .sort((a, b) => {
      const ai = a.cleaned.incomplete ? 0 : 1;
      const bi = b.cleaned.incomplete ? 0 : 1;
      if (bi !== ai) return bi - ai;
      return (b.cleaned.text?.length || 0) - (a.cleaned.text?.length || 0);
    });

  return ranked[0];
}

async function handleOcr(request, env) {
  if (!env.AI) return json({ error: 'AI_NOT_BOUND' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const image = body.image || body.imageBase64;
  if (!image || typeof image !== 'string') {
    return json({ error: 'MISSING_IMAGE' }, 400);
  }

  // Limit ~4MB base64 payload
  if (image.length > 5_500_000) {
    return json({ error: 'IMAGE_TOO_LARGE' }, 413);
  }

  try {
    const ranked = await runVisionOcr(env, image);
    const cleaned = ranked.cleaned || cleanOcrText(ranked.raw);
    let { text, meta, incomplete, frontOnly, itemCount } = cleaned;

    // Also accept a hint name from the client (user typed / previous product)
    const hintName = typeof body.nameHint === 'string' ? body.nameHint.trim() : '';
    const searchName = meta.name || hintName;

    let dbProduct = null;
    if (searchName) {
      dbProduct = await searchOffByName(searchName);
    }

    if (dbProduct && hasIngredients(dbProduct)) {
      return json({
        ok: true,
        ingredients:
          dbProduct.ingredients_text_es ||
          dbProduct.ingredients_text_en ||
          dbProduct.ingredients_text,
        name: pickName(dbProduct),
        brand: dbProduct.brands || meta.brand || '',
        empty: false,
        incomplete: false,
        fromDatabase: true,
        source: dbProduct._verdiscan_source,
        product: enrichForClient(dbProduct),
      });
    }

    // Recompute incomplete if missing from older path
    if (incomplete == null) {
      itemCount = countIngredientItems(text);
      incomplete = itemCount < 5 || (text || '').length < 40;
    }

    if (!text) {
      return json({
        ok: true,
        ingredients: '',
        name: meta.name || hintName || '',
        brand: meta.brand || '',
        empty: true,
        incomplete: true,
        frontOnly: Boolean(frontOnly),
      });
    }

    return json({
      ok: true,
      ingredients: text,
      name: meta.name || hintName || '',
      brand: meta.brand || '',
      empty: false,
      incomplete: Boolean(incomplete),
      frontOnly: Boolean(frontOnly),
      itemCount: itemCount || countIngredientItems(text),
      fromDatabase: false,
    });
  } catch (err) {
    return json(
      {
        error: 'OCR_FAILED',
        detail: String(err?.message || err),
        models: err?.details || [],
      },
      502
    );
  }
}

function enrichForClient(p) {
  return {
    code: p.code,
    product_name: pickName(p),
    brands: p.brands || '',
    ingredients_text: p.ingredients_text || '',
    ingredients_text_es: p.ingredients_text_es || '',
    ingredients_text_en: p.ingredients_text_en || '',
    nova_group: p.nova_group,
    additives_n: p.additives_n,
    additives_tags: p.additives_tags,
    labels_tags: p.labels_tags,
    categories_tags: p.categories_tags,
    nutriments: p.nutriments,
    image_front_url: p.image_front_url,
    image_url: p.image_url,
    _verdiscan_source: p._verdiscan_source,
  };
}

async function handleProduct(request, code, env) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401);

  const gate = canScan(user);
  if (!gate.allowed) {
    return json(
      {
        error: 'SCAN_LIMIT',
        scansUsed: user.scansUsed,
        scansLimit: FREE_SCANS,
        message: 'Free scan limit reached. Unlock unlimited for $5.',
      },
      402
    );
  }

  const result = await lookupProduct(code);
  if (result.error) return json(result, 400);
  if (!result.product) {
    return json({ status: 0, sourcesTried: result.sourcesTried }, 404);
  }

  const consumed = await consumeScan(env.USERS, user);
  return json({
    status: 1,
    product: result.product,
    sourcesTried: result.sourcesTried,
    account: consumed.user,
  });
}

async function handleOcrAuth(request, env) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401);

  const gate = canScan(user);
  if (!gate.allowed) {
    return json(
      {
        error: 'SCAN_LIMIT',
        scansUsed: user.scansUsed,
        scansLimit: FREE_SCANS,
        message: 'Free scan limit reached. Unlock unlimited for $5.',
      },
      402
    );
  }

  const res = await handleOcr(request, env);
  if (res.status === 200) {
    const body = await res.json();
    if (body.ok) {
      const consumed = await consumeScan(env.USERS, user);
      body.account = consumed.user;
    }
    return json(body, 200);
  }
  return res;
}

async function handleAuthRegister(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'INVALID_JSON' }, 400);
    }
    if (!env.USERS) return json({ error: 'KV_NOT_BOUND' }, 503);
    const result = await registerUser(env, body);
    if (result.error) return json({ error: result.error }, result.status);
    return json(result);
  } catch (err) {
    return json({ error: 'REGISTER_FAILED', detail: String(err?.message || err) }, 500);
  }
}

async function handleAuthLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }
  const result = await loginUser(env, body);
  if (result.error) return json({ error: result.error }, result.status);
  return json(result);
}

async function handleAuthMe(request, env) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
  return json({ user: publicUser(user) });
}

async function handleAuthLogout(request, env) {
  await deleteSession(env.USERS, bearerToken(request));
  return json({ ok: true });
}

async function handleBillingCheckout(request, env) {
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
  if (user.paid) return json({ error: 'ALREADY_PAID', user: publicUser(user) }, 400);

  const origin = new URL(request.url).origin;
  const result = await createCheckoutSession(env, user, origin);
  if (result.error) return json(result, result.status || 502);
  return json(result);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsPreflight();

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      return handleAuthRegister(request, env);
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleAuthLogin(request, env);
    }
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      return handleAuthMe(request, env);
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return handleAuthLogout(request, env);
    }
    if (url.pathname === '/api/billing/checkout' && request.method === 'POST') {
      return handleBillingCheckout(request, env);
    }
    if (url.pathname === '/api/billing/webhook' && request.method === 'POST') {
      const result = await handleStripeWebhook(request, env, (email) =>
        markUserPaid(env.USERS, email)
      );
      if (result.error) return json(result, result.status);
      return json(result);
    }

    if (url.pathname === '/api/ocr' && request.method === 'POST') {
      return handleOcrAuth(request, env);
    }

    if (url.pathname.startsWith('/api/product/') && request.method === 'GET') {
      const code = url.pathname.replace('/api/product/', '');
      return handleProduct(request, code, env);
    }

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        ai: Boolean(env.AI),
        kv: Boolean(env.USERS),
        version: '2.5.9',
        freeScans: FREE_SCANS,
        priceUsd: 5,
      });
    }

    // Static assets (PWA)
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
