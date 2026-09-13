/**
 * User allergies & avoid list — match forces score 0 / allergy risk.
 */

export const ALLERGEN_PRESETS = [
  {
    id: 'milk',
    label: { es: 'Lácteos / leche', en: 'Dairy / milk' },
    patterns: [
      /\bmilk\b/i,
      /\bdairy\b/i,
      /\bwhey\b/i,
      /\bcasein\b/i,
      /\blactose\b/i,
      /\bbutter\b/i,
      /\bcream\b/i,
      /\bcheese\b/i,
      /\byogurt\b/i,
      /\byoghurt\b/i,
      /\bleche\b/i,
      /\bl[aá]cteo/i,
      /\bsuero\b/i,
      /\bcase[ií]na\b/i,
      /\blactosa\b/i,
      /\bmantequilla\b/i,
      /\bcrema\b/i,
      /\bqueso\b/i,
      /\byogur/i,
      /en:milk/i,
      /en:dairy/i,
    ],
  },
  {
    id: 'egg',
    label: { es: 'Huevo', en: 'Egg' },
    patterns: [/\begg\b/i, /\beggs\b/i, /\balbumin/i, /\bhuevo\b/i, /\bhuevos\b/i, /en:egg/i],
  },
  {
    id: 'peanut',
    label: { es: 'Cacahuate / maní', en: 'Peanut' },
    patterns: [/\bpeanut/i, /\bcacahuate/i, /\bman[ií]\b/i, /en:peanut/i],
  },
  {
    id: 'tree_nut',
    label: { es: 'Frutos secos', en: 'Tree nuts' },
    patterns: [
      /\balmond/i,
      /\bcashew/i,
      /\bwalnut/i,
      /\bpecan/i,
      /\bhazelnut/i,
      /\bpistachio/i,
      /\bmacadamia/i,
      /\bbrazil\s+nut/i,
      /\balmendr/i,
      /\bnuez\b/i,
      /\bnueces\b/i,
      /\bavellana/i,
      /\bpistacho/i,
      /\banacardo/i,
      /en:nuts/i,
      /en:tree-nuts/i,
    ],
  },
  {
    id: 'soy',
    label: { es: 'Soya / soja', en: 'Soy' },
    patterns: [/\bsoy\b/i, /\bsoya\b/i, /\bsoja\b/i, /\bsoybean/i, /en:soy/i, /en:soya/i],
  },
  {
    id: 'wheat_gluten',
    label: { es: 'Trigo / gluten', en: 'Wheat / gluten' },
    patterns: [
      /\bwheat\b/i,
      /\bgluten\b/i,
      /\bflour\b/i,
      /\btrigo\b/i,
      /\bharina\b/i,
      /\bcebada\b/i,
      /\bbarley\b/i,
      /\brye\b/i,
      /\bcenteno\b/i,
      /en:gluten/i,
      /en:wheat/i,
    ],
  },
  {
    id: 'fish',
    label: { es: 'Pescado', en: 'Fish' },
    patterns: [/\bfish\b/i, /\bcod\b/i, /\bsalmon\b/i, /\btuna\b/i, /\bpescado\b/i, /\bat[uú]n\b/i, /en:fish/i],
  },
  {
    id: 'shellfish',
    label: { es: 'Mariscos / crustáceos', en: 'Shellfish' },
    patterns: [
      /\bshellfish\b/i,
      /\bshrimp\b/i,
      /\bcrab\b/i,
      /\blobster\b/i,
      /\bclam\b/i,
      /\bmussel\b/i,
      /\boyster\b/i,
      /\bcamar[oó]n/i,
      /\bcangrejo/i,
      /\bmarisco/i,
      /\bcrust[aá]ceo/i,
      /en:crustaceans/i,
      /en:molluscs/i,
    ],
  },
  {
    id: 'sesame',
    label: { es: 'Sésamo / ajonjolí', en: 'Sesame' },
    patterns: [/\bsesame\b/i, /\bs[eé]samo\b/i, /\bajonjol[ií]/i, /en:sesame/i],
  },
  {
    id: 'mustard',
    label: { es: 'Mostaza', en: 'Mustard' },
    patterns: [/\bmustard\b/i, /\bmostaza\b/i, /en:mustard/i],
  },
  {
    id: 'sulfites',
    label: { es: 'Sulfitos', en: 'Sulfites' },
    patterns: [/\bsulfite/i, /\bsulphite/i, /\bsulfito/i, /\bsulphite/i, /e220/i, /e221/i, /e222/i, /en:sulphites/i],
  },
  {
    id: 'seed_oils_avoid',
    label: { es: 'Aceites de semilla (evitar)', en: 'Seed oils (avoid)' },
    patterns: [
      /soy\s*(bean)?\s*oil/i,
      /canola\s*oil/i,
      /sunflower\s*oil/i,
      /corn\s*oil/i,
      /vegetable\s*oil/i,
      /aceite\s+de\s+soya/i,
      /aceite\s+de\s+canola/i,
      /aceite\s+de\s+girasol/i,
      /aceite\s+de\s+ma[ií]z/i,
      /aceite\s+vegetal/i,
    ],
  },
];

const STORAGE_KEY = 'verdiscan_allergies_v1';

export function defaultAllergyPrefs() {
  return {
    presets: {},
    custom: [],
  };
}

export function loadAllergyPrefs() {
  const base = defaultAllergyPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    base.presets = parsed.presets && typeof parsed.presets === 'object' ? parsed.presets : {};
    base.custom = Array.isArray(parsed.custom)
      ? parsed.custom.map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
      : [];
  } catch {
    /* keep defaults */
  }
  return base;
}

export function saveAllergyPrefs(prefs) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      presets: prefs.presets || {},
      custom: (prefs.custom || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 40),
    })
  );
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchBlob(product, ingredientsText) {
  const allergens = Array.isArray(product.allergens_tags) ? product.allergens_tags.join(' ') : '';
  const traces = Array.isArray(product.traces_tags) ? product.traces_tags.join(' ') : '';
  const labels = Array.isArray(product.labels_tags) ? product.labels_tags.join(' ') : '';
  const categories = Array.isArray(product.categories_tags) ? product.categories_tags.join(' ') : '';
  return [
    ingredientsText || '',
    product.ingredients_text || '',
    product.ingredients_text_es || '',
    product.ingredients_text_en || '',
    product.product_name || '',
    product.brands || '',
    product.allergens || '',
    product.allergens_from_ingredients || '',
    allergens,
    traces,
    labels,
    categories,
  ]
    .join(' \n ')
    .toLowerCase();
}

/**
 * @returns {{ hits: Array<{id:string,label:string,kind:'preset'|'custom'}>, allergyRisk: boolean }}
 */
export function matchAllergies(product, ingredientsText, prefs, lang = 'es') {
  const prefsSafe = prefs || defaultAllergyPrefs();
  const blob = buildSearchBlob(product, ingredientsText);
  const hits = [];
  const seen = new Set();

  for (const preset of ALLERGEN_PRESETS) {
    if (!prefsSafe.presets?.[preset.id]) continue;
    const matched = preset.patterns.some((p) => p.test(blob));
    if (!matched) continue;
    if (seen.has(preset.id)) continue;
    seen.add(preset.id);
    hits.push({
      id: preset.id,
      label: preset.label[lang] || preset.label.en,
      kind: 'preset',
    });
  }

  for (const custom of prefsSafe.custom || []) {
    const term = String(custom).trim();
    if (term.length < 2) continue;
    const re = new RegExp(`(?:^|[^a-záéíóúñü0-9])${escapeRegExp(term)}(?:$|[^a-záéíóúñü0-9])`, 'i');
    if (!re.test(blob) && !blob.includes(term.toLowerCase())) continue;
    const key = `custom:${term.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      id: key,
      label: term,
      kind: 'custom',
    });
  }

  return { hits, allergyRisk: hits.length > 0 };
}

export function activeAllergyCount(prefs) {
  const p = prefs || defaultAllergyPrefs();
  const presetCount = Object.values(p.presets || {}).filter(Boolean).length;
  return presetCount + (p.custom || []).length;
}
