/**
 * User-adjustable scoring criteria.
 * Multipliers: 0 = off, 0.5 = low, 1 = balanced (default), 1.5 = high, 2 = max
 */

export const WEIGHT_LEVELS = [
  { value: 0, key: 'weightOff' },
  { value: 0.5, key: 'weightLow' },
  { value: 1, key: 'weightMid' },
  { value: 1.5, key: 'weightHigh' },
  { value: 2, key: 'weightMax' },
];

/** Default = middle (1). Maps UI factors → scoring penalty categories */
export const SCORING_FACTORS = [
  {
    id: 'seed_oils',
    categories: ['seed_oil'],
    weightKeys: ['seedOil'],
    default: 1,
    label: { es: 'Aceites de semilla', en: 'Seed oils' },
    hint: {
      es: 'Soya, canola, girasol, maíz, vegetal genérico…',
      en: 'Soy, canola, sunflower, corn, generic vegetable…',
    },
  },
  {
    id: 'artificial_sweeteners',
    categories: ['sweetener'],
    weightKeys: ['sweetenerHigh'],
    default: 1,
    label: { es: 'Edulcorantes artificiales', en: 'Artificial sweeteners' },
    hint: {
      es: 'Aspartamo, sucralosa, acesulfamo-K, etc. (stevia/monk fruit OK)',
      en: 'Aspartame, sucralose, acesulfame-K, etc. (stevia/monk fruit OK)',
    },
  },
  {
    id: 'added_sugars',
    categories: ['added_sugar', 'nutrition_sugar'],
    weightKeys: ['highSugar', 'highSugarMild', 'highSugarHigh', 'multipleAddedSugars', 'addedSugarExtra', 'hfcs'],
    default: 1,
    label: { es: 'Azúcares añadidos', en: 'Added sugars' },
    hint: {
      es: 'Azúcar, jarabes, miel industrial y azúcares altos por 100 g',
      en: 'Sugar, syrups, industrial honey and high sugars per 100 g',
    },
  },
  {
    id: 'total_carbs',
    categories: ['nutrition_carbs'],
    weightKeys: ['highCarbs', 'veryHighCarbs'],
    default: 1,
    label: { es: 'Carbohidratos totales', en: 'Total carbohydrates' },
    hint: {
      es: 'Penaliza productos densos en carbohidratos por 100 g',
      en: 'Penalizes carb-dense products per 100 g',
    },
  },
  {
    id: 'ultra_processed',
    categories: ['nova', 'nova_marker', 'additive_cluster'],
    weightKeys: [
      'nova3Processed',
      'nova4MarkerClassic',
      'nova4MarkerClean',
      'hydrogenated',
      'upfAdditiveCluster',
    ],
    default: 1,
    label: { es: 'Ultraprocesado (NOVA)', en: 'Ultra-processed (NOVA)' },
    hint: {
      es: 'Marcadores industriales, almidones modificados, techos NOVA 4',
      en: 'Industrial markers, modified starches, NOVA 4 ceilings',
    },
  },
  {
    id: 'additives',
    categories: ['additive'],
    weightKeys: ['additiveHigh', 'additiveModerate', 'additiveLow'],
    default: 1,
    label: { es: 'Aditivos preocupantes', en: 'Concerning additives' },
    hint: {
      es: 'Nitritos, colorantes, emulsificantes (E471, carragenina…)',
      en: 'Nitrites, dyes, emulsifiers (E471, carrageenan…)',
    },
  },
  {
    id: 'sodium',
    categories: ['nutrition_sodium'],
    weightKeys: ['highSodium'],
    default: 1,
    label: { es: 'Sodio / sal', en: 'Sodium / salt' },
    hint: {
      es: 'Alto contenido de sodio por 100 g',
      en: 'High sodium content per 100 g',
    },
  },
  {
    id: 'saturated_fat',
    categories: ['nutrition_satfat'],
    weightKeys: ['highSatFat'],
    default: 0.5,
    label: { es: 'Grasas saturadas', en: 'Saturated fat' },
    hint: {
      es: 'Por dato nutricional (default más suave)',
      en: 'From nutrition facts (softer default)',
    },
  },
  {
    id: 'processed_meat',
    categories: ['processed_meat', 'jerky'],
    weightKeys: ['processedMeat', 'jerkyConcernModerate', 'jerkyConcernLow'],
    default: 1,
    label: { es: 'Carne procesada', en: 'Processed meat' },
    hint: {
      es: 'Jamón, salchicha, jerky, nitritos / apio cultivado',
      en: 'Ham, sausage, jerky, nitrites / cultured celery',
    },
  },
  {
    id: 'bioengineered',
    categories: ['bioengineered'],
    weightKeys: ['bioengineeredHigh', 'bioengineeredModerate', 'bioengineeredModerateClean'],
    default: 1,
    label: { es: 'Bioingeniería / imitaciones', en: 'Bioengineered / imitations' },
    hint: {
      es: 'Solo si la etiqueta lo declara: bioingeniería, carne vegetal, imitaciones',
      en: 'Only when labeled: bioengineered, plant-based meat, imitations',
    },
  },
  {
    id: 'animal_husbandry',
    categories: ['husbandry'],
    weightKeys: ['conventionalAnimal', 'unknownHusbandry'],
    default: 1,
    label: { es: 'Crianza / antibióticos', en: 'Husbandry / antibiotics' },
    hint: {
      es: 'Huevos, pollo, carne o lácteos sin sello orgánico/sin antibióticos',
      en: 'Eggs, poultry, meat or dairy without organic/antibiotic-free claim',
    },
  },
  {
    id: 'artificial_flavors',
    categories: ['artificial'],
    weightKeys: ['artificialHigh', 'artificialModerate', 'artificialModerateClean'],
    default: 1,
    label: { es: 'Sabores / aromas artificiales', en: 'Artificial flavors' },
    hint: {
      es: 'Natural flavors, colorantes sintéticos, “aroma artificial”',
      en: 'Natural flavors, synthetic dyes, “artificial flavor”',
    },
  },
  {
    id: 'protein',
    kind: 'bonus',
    categories: ['nutrition_protein'],
    weightKeys: ['bonusProteinMild', 'bonusProtein', 'bonusProteinHigh'],
    default: 1,
    label: { es: 'Proteína (bono)', en: 'Protein (bonus)' },
    hint: {
      es: 'Suma puntos si hay ≥10 / 15 / 20 g por 100 g',
      en: 'Adds points when ≥10 / 15 / 20 g per 100 g',
    },
  },
  {
    id: 'fiber',
    kind: 'bonus',
    categories: ['nutrition_fiber'],
    weightKeys: ['bonusFiberMild', 'bonusFiber', 'bonusFiberHigh'],
    default: 1,
    label: { es: 'Fibra (bono)', en: 'Fiber (bonus)' },
    hint: {
      es: 'Suma puntos si hay ≥3 / 6 / 10 g por 100 g',
      en: 'Adds points when ≥3 / 6 / 10 g per 100 g',
    },
  },
];

const STORAGE_KEY = 'verdiscan_criteria_weights_v2';

export function defaultWeights() {
  const out = {};
  for (const f of SCORING_FACTORS) out[f.id] = f.default;
  return out;
}

export function loadWeights() {
  const base = defaultWeights();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('verdiscan_criteria_weights_v1');
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    for (const f of SCORING_FACTORS) {
      if (typeof parsed[f.id] === 'number') {
        base[f.id] = snapToLevel(parsed[f.id]);
      }
    }
  } catch {
    /* keep defaults */
  }
  return base;
}

export function saveWeights(weights) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
}

function snapToLevel(n) {
  let best = WEIGHT_LEVELS[0].value;
  let dist = Math.abs(n - best);
  for (const lv of WEIGHT_LEVELS) {
    const d = Math.abs(n - lv.value);
    if (d < dist) {
      dist = d;
      best = lv.value;
    }
  }
  return best;
}

/** Map penalty category → factor multiplier */
export function categoryMultiplier(weights, category) {
  const factor = SCORING_FACTORS.find((f) => f.categories.includes(category));
  if (!factor) return 1;
  const m = weights[factor.id];
  return typeof m === 'number' ? m : factor.default;
}

/** Scale a numeric SCORE_WEIGHTS key by its owning factor */
export function scaleWeightKey(baseWeights, userWeights, key) {
  const factor = SCORING_FACTORS.find((f) => f.weightKeys.includes(key));
  const m = factor ? userWeights[factor.id] ?? factor.default : 1;
  const base = baseWeights[key];
  if (typeof base !== 'number') return base;
  return Math.round(base * m);
}

export function levelIndex(value) {
  return WEIGHT_LEVELS.findIndex((l) => l.value === value);
}

export function levelLabelKey(value) {
  return WEIGHT_LEVELS.find((l) => l.value === value)?.key || 'weightMid';
}
