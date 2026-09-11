const UA = 'VerdiScan/2.4 (https://scan.predictacore.ai; food health scanner)';

const FIELDS = [
  'code', 'product_name', 'product_name_es', 'product_name_en',
  'brands', 'image_url', 'image_front_url',
  'ingredients_text', 'ingredients_text_es', 'ingredients_text_en',
  'nova_group', 'nova_groups', 'additives_tags', 'additives_n',
  'nutriments', 'nutriscore_grade', 'countries_tags',
  'categories_tags', 'labels_tags',
].join(',');

const OFF_ENDPOINTS = [
  { id: 'off-world', base: 'https://world.openfoodfacts.org/api/v2/product' },
  { id: 'off-mx', base: 'https://mx.openfoodfacts.org/api/v2/product' },
  { id: 'off-us', base: 'https://us.openfoodfacts.org/api/v2/product' },
];

function normalizeBarcode(barcode) {
  return String(barcode).replace(/\D/g, '');
}

function enrichProduct(product, clean, source) {
  product.code = product.code || clean;
  product.product_name =
    product.product_name_es ||
    product.product_name_en ||
    product.product_name ||
    'Producto sin nombre';
  product._verdiscan_source = source || product._verdiscan_source;
  return product;
}

export function getIngredientsText(product) {
  return (
    product.ingredients_text_es ||
    product.ingredients_text_en ||
    product.ingredients_text ||
    ''
  ).trim();
}

export function hasUsableIngredients(product) {
  return getIngredientsText(product).length >= 3;
}

async function fetchFromOff(base, clean) {
  const url = `${base}/${clean}?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

async function fetchFromOpenProducts(clean) {
  try {
    const url = `https://world.openproductsfacts.org/api/v2/product/${clean}?fields=${FIELDS}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

/** Aggregated lookup via our Worker (OFF + USDA + UPCitemdb) */
async function fetchViaWorker(clean, authHeadersFn) {
  try {
    const headers = authHeadersFn
      ? authHeadersFn({ Accept: 'application/json' })
      : { Accept: 'application/json' };
    const res = await fetch(`/api/product/${clean}`, { headers });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status === 402) {
      const data = await res.json().catch(() => ({}));
      const err = new Error('SCAN_LIMIT');
      err.account = data;
      throw err;
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    if (data.account) data.product._verdiscan_account = data.account;
    return data.product;
  } catch (e) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'SCAN_LIMIT') throw e;
    return null;
  }
}

/**
 * Lookup barcode: Worker multi-DB first, then direct OFF fallbacks.
 * @param {string} barcode
 * @param {() => object} [authHeadersFn]
 */
export async function fetchProduct(barcode, authHeadersFn) {
  const clean = normalizeBarcode(barcode);
  if (clean.length < 8) throw new Error('INVALID_BARCODE');

  let lastNetworkError = false;

  try {
    const viaWorker = await fetchViaWorker(clean, authHeadersFn);
    if (viaWorker) return enrichProduct(viaWorker, clean, viaWorker._verdiscan_source || 'worker');
  } catch (e) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'SCAN_LIMIT') throw e;
    lastNetworkError = true;
  }

  for (const ep of OFF_ENDPOINTS) {
    try {
      const product = await fetchFromOff(ep.base, clean);
      if (product) return enrichProduct(product, clean, ep.id);
    } catch {
      lastNetworkError = true;
    }
  }

  try {
    const product = await fetchFromOpenProducts(clean);
    if (product) return enrichProduct(product, clean, 'open-products');
  } catch {
    lastNetworkError = true;
  }

  if (lastNetworkError) throw new Error('NETWORK_ERROR');
  throw new Error('NOT_FOUND');
}

export function isRelevantMarket(product) {
  const countries = (product.countries_tags || []).map((c) => c.toLowerCase());
  return (
    countries.some(
      (c) =>
        c.includes('mexico') ||
        c.includes('united-states') ||
        c.includes('en:mx') ||
        c.includes('en:us')
    ) || countries.length === 0
  );
}
