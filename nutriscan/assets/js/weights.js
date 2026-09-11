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
    why: {
      es: 'Se restan porque son aceites refinados altos en omega-6, frecuentes en ultraprocesados. Preferimos oliva, aguacate, coco o mantequilla. En Medio ≈ −14 por cada aceite detectado.',
      en: 'Penalized because they are refined high-omega-6 oils common in ultra-processed foods. We prefer olive, avocado, coconut or butter. At Medium ≈ −14 per detected oil.',
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
    why: {
      es: 'Se restan por evidencia de alteración metabólica/microbioma (OMS desaconseja NNS para control de peso). Stevia y monk fruit no penalizan. En Medio ≈ −18 por edulcorante de alto riesgo.',
      en: 'Penalized due to metabolic/microbiome concerns (WHO advises against NNS for weight control). Stevia and monk fruit are not penalized. At Medium ≈ −18 per high-risk sweetener.',
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
    why: {
      es: 'Se restan por carga glucémica y patrón de ultraprocesado. Cuenta ingredientes dulces y gramos/100 g (umbrales ~5 / 12 / 22 g). HFCS pesa más. En Medio: −4 a −12 según nivel.',
      en: 'Penalized for glycemic load and ultra-processed patterns. Counts sweet ingredients and g/100 g (thresholds ~5 / 12 / 22 g). HFCS weighs more. At Medium: −4 to −12 by level.',
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
    why: {
      es: 'Útil si te importa control glucémico / bajo carb. No castiga “carbohidratos buenos” por nombre: solo densidad g/100 g (>40 y >60). En Medio: −6 / −10.',
      en: 'Useful if you care about glucose control / low-carb. It does not judge “good carbs” by name—only density g/100 g (>40 and >60). At Medium: −6 / −10.',
    },
  },
  {
    id: 'ultra_processed',
    categories: ['nova', 'nova_marker', 'additive_cluster'],
    weightKeys: [
      'nova3Processed',
      'nova4MarkerClassic',
      'nova4MarkerClean',
      'nova4ProteinIsolate',
      'hydrogenated',
      'upfAdditiveCluster',
    ],
    default: 1,
    label: { es: 'Ultraprocesado (NOVA)', en: 'Ultra-processed (NOVA)' },
    hint: {
      es: 'Marcadores industriales, aislados de proteína, techos NOVA 4',
      en: 'Industrial markers, protein isolates, NOVA 4 ceilings',
    },
    why: {
      es: 'Basado en NOVA (Monteiro): ingredientes raros en cocina casera. Aislados (proteína de leche, suero, etc.) restan poco (−3) porque la proteína no es “mala”, pero sí señalan reformulación industrial. También hay techo de puntuación en NOVA 4. Baja este slider si te importan menos los aislados.',
      en: 'Based on NOVA (Monteiro): ingredients rare in home cooking. Isolates (milk protein, whey, etc.) subtract lightly (−3) because protein isn’t “bad,” but they signal industrial reformulation. NOVA 4 also applies a score ceiling. Lower this slider if isolates matter less to you.',
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
    why: {
      es: 'Se restan aditivos con evidencia de riesgo (NutriNet-Santé, OMS/IARC): nitritos, colorantes sintéticos, algunos emulsificantes. No todos los aditivos “E” se castigan igual: alto ≈ −10, medio ≈ −5, bajo ≈ −2.',
      en: 'Penalizes additives with risk evidence (NutriNet-Santé, WHO/IARC): nitrites, synthetic dyes, some emulsifiers. Not every “E” number is equal: high ≈ −10, moderate ≈ −5, low ≈ −2.',
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
    why: {
      es: 'Se resta si supera ~600 mg de sodio / 100 g (dato de etiqueta/base). Relacionado con presión arterial cuando el consumo es frecuente. En Medio ≈ −5.',
      en: 'Subtracts if over ~600 mg sodium / 100 g (label/DB data). Linked to blood pressure with frequent intake. At Medium ≈ −5.',
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
    why: {
      es: 'Se resta si hay >10 g de grasa saturada / 100 g. Default en Bajo porque el contexto (carne, lácteos enteros) importa. En Bajo ≈ −3; en Medio ≈ −6.',
      en: 'Subtracts if >10 g saturated fat / 100 g. Defaults to Low because context (meat, whole dairy) matters. At Low ≈ −3; at Medium ≈ −6.',
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
    why: {
      es: 'OMS/IARC: consumo frecuente de carne procesada vinculado a cáncer colorrectal. Incluye curados, embutidos y fuentes de nitritos (también “apio cultivado”). En Medio ≈ −14 base.',
      en: 'WHO/IARC: frequent processed meat intake linked to colorectal cancer. Includes cured meats, sausages and nitrite sources (including cultured celery). At Medium ≈ −14 base.',
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
    why: {
      es: 'Solo si el empaque lo declara: “Bioengineered”, OGM, carne/lácteo vegetal o imitación. No adivinamos por soya/maíz genéricos. Castiga productos diseñados para parecer otro alimento o con divulgación OGM.',
      en: 'Only when the pack declares it: “Bioengineered”, GMO, plant-based meat/dairy or imitation. We don’t guess from generic soy/corn. Flags foods designed to mimic another food or with GMO disclosure.',
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
    why: {
      es: 'Si es producto animal y no hay sello (orgánico, sin antibióticos, pastoreo…), asumimos crianza convencional. Huevos/pollo pesan más (−16); lácteos/carne menos (−5). No es un juicio nutricional: es de prácticas de crianza. Si no te importa, ponlo en Bajo o Apagado.',
      en: 'If it’s an animal product without a claim (organic, antibiotic-free, pasture…), we assume conventional farming. Eggs/poultry weigh more (−16); dairy/meat less (−5). This is husbandry practice, not nutrition. If you don’t care, set Low or Off.',
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
    why: {
      es: 'Se restan aromas/colorantes sintéticos o “natural flavors” poco transparentes (mezclas industriales sin fuente clara). En Medio: artificial ≈ −12; “natural flavor” ≈ −5 (−3 si el perfil es limpio).',
      en: 'Penalizes synthetic flavors/colors or opaque “natural flavors” (industrial blends without a clear source). At Medium: artificial ≈ −12; “natural flavor” ≈ −5 (−3 on a clean profile).',
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
    why: {
      es: 'Bono nutricional: suma si hay buena densidad de proteína (≥10 / 15 / 20 g/100 g → +4 / +6 / +8 en Medio). Es independiente del castigo por “aislado”: un batido puede sumar proteína y aún restar un poco por ser aislado industrial.',
      en: 'Nutrition bonus: adds for protein density (≥10 / 15 / 20 g/100 g → +4 / +6 / +8 at Medium). Independent of isolate penalties: a shake can gain protein points and still lose a little for industrial isolate form.',
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
    why: {
      es: 'Bono por fibra dietética (≥3 / 6 / 10 g/100 g → +3 / +5 / +8 en Medio). Asociada a saciedad y mejor perfil de alimento integral. Solo aplica si la base reporta fibra.',
      en: 'Bonus for dietary fiber (≥3 / 6 / 10 g/100 g → +3 / +5 / +8 at Medium). Linked to satiety and a more whole-food profile. Only applies when the DB reports fiber.',
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
