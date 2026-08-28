const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = [
  'code', 'product_name', 'product_name_es', 'product_name_en',
  'brands', 'image_url', 'image_front_url',
  'ingredients_text', 'ingredients_text_es', 'ingredients_text_en',
  'nova_group', 'nova_groups', 'additives_tags', 'additives_n',
  'nutriments', 'nutriscore_grade', 'countries_tags',
  'categories_tags', 'labels_tags',
].join(',');

export async function fetchProduct(barcode) {
  const clean = String(barcode).replace(/\D/g, '');
  if (clean.length < 8) throw new Error('INVALID_BARCODE');

  const url = `${OFF_BASE}/${clean}?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error('NETWORK_ERROR');

  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    throw new Error('NOT_FOUND');
  }

  const product = data.product;
  product.code = product.code || clean;
  product.product_name =
    product.product_name_es ||
    product.product_name_en ||
    product.product_name ||
    'Producto sin nombre';

  return product;
}

export function isRelevantMarket(product) {
  const countries = (product.countries_tags || []).map((c) => c.toLowerCase());
  return countries.some(
    (c) => c.includes('mexico') || c.includes('united-states') || c.includes('en:mx') || c.includes('en:us')
  ) || countries.length === 0;
}
