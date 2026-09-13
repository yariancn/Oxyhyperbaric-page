import {
  SEVERITY,
  SCORE_WEIGHTS,
  NOVA4_MARKERS,
  SEED_OILS,
  HEALTHY_FATS,
  FLAGGED_SWEETENERS,
  ALLOWED_SWEETENERS,
  ARTIFICIAL_MARKERS,
  JERKY_CONCERNS,
  PROCESSED_MEAT,
  findMatches,
  findAllNova4Hits,
  findAdditiveMatches,
  detectNovaGroup,
  collectUltraProcessedIndicators,
  detectBioengineered,
  classifyUpfTier,
  upfTierLabel,
  assessCleanProfile,
  detectProcessedMeat,
  countAddedSweetenerTypes,
  normalizeText,
  detectAnimalProduct,
  hasAntibioticFreeClaim,
} from './rules.js';
import { categoryMultiplier, defaultWeights } from './weights.js';
import { matchAllergies, defaultAllergyPrefs } from './allergies.js';

const MAX_SCORE = 100;

function L(lang, es, en) {
  return lang === 'es' ? es : en;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildAlert(category, severity, label, note, lang) {
  return {
    category,
    severity,
    label: typeof label === 'object' ? label[lang] || label.en : label,
    note: typeof note === 'object' ? note?.[lang] || note?.en || '' : note || '',
  };
}

class ScoreLedger {
  constructor(lang) {
    this.lang = lang;
    this.lines = [];
    this.total = MAX_SCORE;
  }

  addPenalty(id, labelEs, labelEn, weight, reasonEs, reasonEn) {
    if (weight <= 0) return;
    this.lines.push({
      id,
      label: L(this.lang, labelEs, labelEn),
      delta: -weight,
      reason: L(this.lang, reasonEs, reasonEn),
    });
    this.total -= weight;
  }

  addBonus(id, labelEs, labelEn, weight, reasonEs, reasonEn) {
    if (weight <= 0) return;
    this.lines.push({
      id,
      label: L(this.lang, labelEs, labelEn),
      delta: +weight,
      reason: L(this.lang, reasonEs, reasonEn),
    });
    this.total += weight;
  }

  finalize() {
    return {
      score: Math.max(5, Math.min(100, Math.round(this.total))),
      breakdown: this.lines,
    };
  }
}

function computeGrade(score, lang) {
  if (score >= 75) {
    return { grade: lang === 'es' ? 'Excelente' : 'Excellent', gradeColor: 'excellent' };
  }
  if (score >= 55) {
    return { grade: lang === 'es' ? 'Aceptable' : 'Acceptable', gradeColor: 'good' };
  }
  if (score >= 35) {
    return { grade: lang === 'es' ? 'Precaución' : 'Caution', gradeColor: 'caution' };
  }
  return { grade: lang === 'es' ? 'Evitar' : 'Avoid', gradeColor: 'avoid' };
}

function buildVerdict(lang, ctx) {
  const { isCleanProfile, isProcessedMeat, seedOils, addedSugars, wholeFoodSignals, alerts, positives, ultraProcessedItems } = ctx;
  const good = [];
  const bad = [];

  for (const s of wholeFoodSignals) {
    good.push(typeof s.label === 'object' ? s.label[lang] || s.label.en : s.label);
  }
  if (seedOils.length === 0) {
    good.push(L(lang, 'Sin aceites de semilla (incluido en base 100)', 'No seed oils (included in 100 baseline)'));
  }
  if (!alerts.some((a) => a.category === 'sweetener')) {
    good.push(L(lang, 'Sin edulcorantes artificiales (incluido en base 100)', 'No artificial sweeteners (included in 100 baseline)'));
  }
  for (const p of positives) {
    if (p.label && !good.includes(p.label)) good.push(p.label);
  }
  if (isCleanProfile && isProcessedMeat) {
    good.push(L(lang, 'Mejor perfil que jerky/snacks industrializados típicos', 'Better profile than typical industrial jerky/snacks'));
  }

  if (isProcessedMeat) {
    bad.push(L(lang, 'Carne procesada/curada — limitar si es frecuente', 'Processed/cured meat — limit if eaten often'));
  }
  if (addedSugars.length >= 2) {
    bad.push(
      L(
        lang,
        `Varios endulzantes (${addedSugars.join(', ')})`,
        `Multiple sweeteners (${addedSugars.join(', ')})`
      )
    );
  }
  for (const item of ultraProcessedItems) {
    if (item.type === 'jerky' || item.type === 'artificial' || item.type === 'additive') {
      if (!bad.includes(item.label)) bad.push(item.label);
    }
  }

  return {
    good: [...new Set(good)].slice(0, 6),
    bad: [...new Set(bad)].slice(0, 6),
  };
}

export function analyzeProduct(product, lang = 'es', userWeights = null, allergyPrefs = null) {
  const weights = userWeights || defaultWeights();
  const allergies = allergyPrefs || defaultAllergyPrefs();
  const ingredientsText =
    product.ingredients_text_es ||
    product.ingredients_text_en ||
    product.ingredients_text ||
    '';
  const alerts = [];
  const positives = [];
  const ledger = new ScoreLedger(lang);
  const scored = new Set();

  const trimmedIngredients = ingredientsText.trim();
  if (!trimmedIngredients || trimmedIngredients.length < 3) {
    return {
      score: null,
      grade: lang === 'es' ? 'Sin datos' : 'Incomplete',
      gradeColor: 'caution',
      needsIngredients: true,
      novaGroup: null,
      upfTier: null,
      upfTierLabel: '',
      isProcessedMeat: false,
      isCleanProfile: false,
      ultraProcessedItems: [],
      bioengineeredItems: [],
      goodPoints: [],
      badPoints: [
        L(
          lang,
          'No hay lista de ingredientes en la base de datos',
          'No ingredient list in the database'
        ),
      ],
      scoreBreakdown: [],
      alerts: [],
      positives: [],
      summary: L(
        lang,
        'Sin calificación: necesitamos la lista de ingredientes del empaque.',
        'No score: we need the ingredient list from the package.'
      ),
      rulesVersion: '2.6.0',
      allergyRisk: false,
      allergyHits: [],
    };
  }

  const novaGroup = detectNovaGroup(product, ingredientsText);
  const isProcessedMeat = detectProcessedMeat(ingredientsText);
  const { tier: upfTier, wholeFoodSignals: tierWholeFoods } = classifyUpfTier(product, ingredientsText);
  const { isClean: isCleanProfile, wholeFoodSignals } = assessCleanProfile(product, ingredientsText);
  const ultraProcessedItems = collectUltraProcessedIndicators(product, ingredientsText, lang);
  const { findings: bioengineeredItems, hasNonGmoLabel } = detectBioengineered(product, ingredientsText, lang);
  const addedSugars = countAddedSweetenerTypes(ingredientsText);
  const seedOils = findMatches(ingredientsText, SEED_OILS);
  const profileWholeFoods = wholeFoodSignals.length ? wholeFoodSignals : tierWholeFoods;
  const text = normalizeText(ingredientsText);

  function scaled(baseWeight, category) {
    const m = categoryMultiplier(weights, category);
    if (m <= 0) return 0;
    return Math.max(0, Math.round(baseWeight * m));
  }

  function penalize(id, labelEs, labelEn, weight, reasonEs, reasonEn, severity, category, noteObj) {
    if (scored.has(id)) return;
    const w = typeof weight === 'number' ? weight : 0;
    if (w <= 0) return;
    scored.add(id);
    ledger.addPenalty(id, labelEs, labelEn, w, reasonEs, reasonEn);
    if (severity && category) {
      alerts.push(buildAlert(category, severity, L(lang, labelEs, labelEn), noteObj, lang));
    }
  }

  function reward(id, labelEs, labelEn, weight, reasonEs, reasonEn) {
    if (scored.has(id)) return;
    const w = typeof weight === 'number' ? weight : 0;
    if (w <= 0) return;
    scored.add(id);
    ledger.addBonus(id, labelEs, labelEn, w, reasonEs, reasonEn);
    positives.push(
      buildAlert(
        'nutrition_bonus',
        SEVERITY.INFO,
        L(lang, labelEs, labelEn),
        { es: reasonEs, en: reasonEn },
        lang
      )
    );
  }

  function applyCap(id, cap, labelEs, labelEn, reasonEs, reasonEn) {
    if (ledger.total <= cap || scored.has(id)) return;
    const weight = Math.round(ledger.total - cap);
    scored.add(id);
    ledger.addPenalty(id, labelEs, labelEn, weight, reasonEs, reasonEn);
  }

  // ── NOVA: clasificación informativa; NOVA 4 se refleja en ingredientes + tope ──
  if (novaGroup === 4) {
    alerts.push(
      buildAlert(
        'nova',
        upfTier === 'classic' ? SEVERITY.CRITICAL : SEVERITY.HIGH,
        L(lang, 'Ultraprocesado (NOVA 4)', 'Ultra-processed (NOVA 4)'),
        {
          es: `Formulación industrial${upfTierLabel(upfTier, 'es') ? ` · ${upfTierLabel(upfTier, 'es')}` : ''}.`,
          en: `Industrial formulation${upfTierLabel(upfTier, 'en') ? ` · ${upfTierLabel(upfTier, 'en')}` : ''}.`,
        },
        lang
      )
    );
  } else if (novaGroup === 3 && !isProcessedMeat) {
    penalize(
      'nova3',
      'Nivel de procesamiento NOVA 3',
      'NOVA 3 processing level',
      scaled(SCORE_WEIGHTS.nova3Processed, 'nova'),
      'Alimento procesado moderadamente (conservas, curados simples).',
      'Moderately processed food (canned, simple cured).',
      SEVERITY.MODERATE,
      'nova',
      {
        es: 'Procesado, no ultraprocesado.',
        en: 'Processed, not ultra-processed.',
      }
    );
  } else if (novaGroup === 3 && isProcessedMeat) {
    alerts.push(
      buildAlert(
        'nova',
        SEVERITY.MODERATE,
        L(lang, 'Carne procesada (NOVA 3)', 'Processed meat (NOVA 3)'),
        {
          es: 'Curada/seca/conservada. La puntuación refleja ingredientes concretos abajo.',
          en: 'Cured/dried/preserved. Score reflects specific ingredients below.',
        },
        lang
      )
    );
  } else if (novaGroup === 1 || novaGroup === 2) {
    positives.push(
      buildAlert(
        'nova',
        SEVERITY.INFO,
        { en: `Minimally processed (NOVA ${novaGroup})`, es: `Mínimamente procesado (NOVA ${novaGroup})` },
        { en: 'Closer to whole food — no score penalty.', es: 'Más cercano a alimento integral — sin penalización.' },
        lang
      )
    );
  }

  if (isProcessedMeat) {
    penalize(
      'processed_meat',
      'Carne procesada / curada',
      'Processed / cured meat',
      scaled(SCORE_WEIGHTS.processedMeat, 'processed_meat'),
      'OMS: consumo frecuente vinculado a cáncer colorrectal.',
      'WHO: frequent intake linked to colorectal cancer.',
      SEVERITY.HIGH,
      'processed_meat',
      PROCESSED_MEAT.note
    );
  }

  if (addedSugars.length >= 2) {
    penalize(
      'added_sugars',
      `Endulzantes múltiples (${addedSugars.length})`,
      `Multiple sweeteners (${addedSugars.length})`,
      scaled(
        SCORE_WEIGHTS.multipleAddedSugars +
          Math.max(0, addedSugars.length - 2) * SCORE_WEIGHTS.addedSugarExtra,
        'added_sugar'
      ),
      `Detectados: ${addedSugars.join(', ')}.`,
      `Detected: ${addedSugars.join(', ')}.`,
      SEVERITY.MODERATE,
      'added_sugar',
      {
        es: 'Perfil dulce — común en jerky BBQ; no es edulcorante artificial.',
        en: 'Sweet profile — common in BBQ jerky; not artificial sweetener.',
      }
    );
  }

  for (const concern of findMatches(ingredientsText, JERKY_CONCERNS)) {
    const w =
      concern.severity === SEVERITY.MODERATE
        ? SCORE_WEIGHTS.jerkyConcernModerate
        : SCORE_WEIGHTS.jerkyConcernLow;
    penalize(
      concern.id,
      concern.label.es,
      concern.label.en,
      scaled(w, 'jerky'),
      concern.note.es,
      concern.note.en,
      concern.severity,
      'jerky',
      concern.note
    );
  }

  const nova4Markers = findAllNova4Hits(ingredientsText);
  const markerWeight =
    upfTier === 'clean_label' ? SCORE_WEIGHTS.nova4MarkerClean : SCORE_WEIGHTS.nova4MarkerClassic;

  for (const marker of nova4Markers) {
    let w = markerWeight;
    if (marker.id === 'hfcs') w = SCORE_WEIGHTS.hfcs;
    if (marker.id === 'hydrogenated_oil') w = SCORE_WEIGHTS.hydrogenated;
    if (
      marker.id === 'milk_protein_isolate' ||
      marker.id === 'wheat_protein_isolate' ||
      marker.id === 'soy_protein_isolate' ||
      marker.id === 'whey_or_gluten'
    ) {
      w = SCORE_WEIGHTS.nova4ProteinIsolate;
    }
    const cat = marker.id === 'hfcs' ? 'added_sugar' : 'nova_marker';
    const reasonEs =
      w === SCORE_WEIGHTS.nova4ProteinIsolate
        ? 'Aislado industrial (ligero): la proteína no es mala, pero indica reformulación.'
        : 'Ingrediente poco usado en cocina casera.';
    const reasonEn =
      w === SCORE_WEIGHTS.nova4ProteinIsolate
        ? 'Industrial isolate (light): protein isn’t bad, but it signals reformulation.'
        : 'Ingredient rarely used in home cooking.';
    penalize(
      `marker-${marker.id}`,
      marker.label.es,
      marker.label.en,
      scaled(w, cat),
      reasonEs,
      reasonEn,
      marker.id === 'hydrogenated_oil' ? SEVERITY.CRITICAL : SEVERITY.HIGH,
      cat === 'added_sugar' ? 'added_sugar' : 'nova_marker',
      {
        es: 'Típico de formulaciones industriales.',
        en: 'Typical of industrial formulations.',
      }
    );
  }

  const additiveCount = product.additives_n ?? product.additives_tags?.length ?? 0;
  if (novaGroup === 4 && additiveCount >= 3) {
    penalize(
      'additive_cluster',
      `Patrón de aditivos (${additiveCount})`,
      `Additive cluster (${additiveCount})`,
      scaled(SCORE_WEIGHTS.upfAdditiveCluster, 'nova'),
      'Varios aditivos funcionales — señal de ultraprocesado.',
      'Multiple functional additives — ultra-processed signal.',
      SEVERITY.MODERATE,
      'nova',
      {
        es: 'Los ultraprocesados suelen llevar 3+ aditivos cosméticos.',
        en: 'Ultra-processed foods often carry 3+ cosmetic additives.',
      }
    );
  }

  for (const item of bioengineeredItems) {
    const w =
      item.severity === SEVERITY.HIGH
        ? SCORE_WEIGHTS.bioengineeredHigh
        : SCORE_WEIGHTS.bioengineeredModerate;
    penalize(
      `bio-${item.id}`,
      item.label,
      item.label,
      scaled(w, 'bioengineered'),
      item.note || '',
      item.note || '',
      item.severity,
      'bioengineered',
      {
        es: item.note || '',
        en: item.note || '',
      }
    );
  }

  if (hasNonGmoLabel) {
    positives.push(
      buildAlert(
        'non_gmo',
        SEVERITY.INFO,
        { en: 'Non-GMO / organic label', es: 'Etiqueta sin OGM / orgánica' },
        { en: 'Packaging claims non-GMO or organic certification.', es: 'Empaque declara sin OGM o certificación orgánica.' },
        lang
      )
    );
  }

  for (const art of findMatches(ingredientsText, ARTIFICIAL_MARKERS)) {
    const isNaturalFlavor = art.id === 'natural_flavor';
    const w =
      isNaturalFlavor && (upfTier === 'clean_label' || isCleanProfile)
        ? SCORE_WEIGHTS.artificialModerateClean
        : art.severity === SEVERITY.HIGH
          ? SCORE_WEIGHTS.artificialHigh
          : SCORE_WEIGHTS.artificialModerate;
    penalize(
      `art-${art.id}`,
      art.label.es,
      art.label.en,
      scaled(w, 'artificial'),
      art.note.es,
      art.note.en,
      art.severity,
      'artificial',
      art.note
    );
  }

  for (const oil of seedOils) {
    penalize(
      `oil-${oil.id}`,
      oil.label.es,
      oil.label.en,
      scaled(SCORE_WEIGHTS.seedOil, 'seed_oil'),
      'Aceite de semilla refinado, alto omega-6.',
      'Refined seed oil, high omega-6.',
      SEVERITY.HIGH,
      'seed_oil',
      {
        es: 'Prefiere oliva, aguacate, coco o mantequilla.',
        en: 'Prefer olive, avocado, coconut or butter.',
      }
    );
  }

  // Crianza / antibióticos (huevos, pollo, carne, lácteos)
  const animal = detectAnimalProduct(product, ingredientsText);
  if (animal) {
    const freeClaim = hasAntibioticFreeClaim(product, ingredientsText);
    if (freeClaim) {
      positives.push(
        buildAlert(
          'husbandry',
          SEVERITY.INFO,
          {
            es: `${animal.label.es}: sin antibióticos / orgánica / pastoreo`,
            en: `${animal.label.en}: antibiotic-free / organic / pasture`,
          },
          {
            es: 'Etiqueta o texto indica mejor crianza o sin antibióticos de rutina.',
            en: 'Label or text indicates better husbandry or no routine antibiotics.',
          },
          lang
        )
      );
    } else {
      const w =
        animal.kind === 'egg' || animal.kind === 'poultry'
          ? SCORE_WEIGHTS.conventionalAnimal
          : SCORE_WEIGHTS.unknownHusbandry;
      penalize(
        'conventional_animal',
        animal.kind === 'egg'
          ? 'Huevos sin etiqueta libre de antibióticos'
          : `${animal.label.es}: crianza no verificada`,
        animal.kind === 'egg'
          ? 'Eggs without antibiotic-free label'
          : `${animal.label.en}: unverified husbandry`,
        scaled(w, 'husbandry'),
        'Sin sello orgánico / sin antibióticos / pastoreo, suele ser granja convencional.',
        'Without organic / antibiotic-free / pasture claim, usually conventional farming.',
        SEVERITY.MODERATE,
        'husbandry',
        {
          es: 'Busca: orgánico, sin antibióticos, pastoreo o libre de jaula.',
          en: 'Look for: organic, antibiotic-free, pasture-raised or cage-free.',
        }
      );
    }
  }

  const hasHealthyFat = HEALTHY_FATS.some((p) => p.test(text));
  if (hasHealthyFat && seedOils.length === 0) {
    positives.push(
      buildAlert(
        'healthy_fat',
        SEVERITY.INFO,
        { en: 'Contains traditional fats', es: 'Contiene grasas tradicionales' },
        { en: 'Olive, avocado, coconut or butter detected.', es: 'Aceite de oliva, aguacate, coco o mantequilla detectados.' },
        lang
      )
    );
  }

  for (const sw of findMatches(ingredientsText, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length))) {
    penalize(
      `sw-${sw.id}`,
      sw.label.es || sw.label.en,
      sw.label.en,
      scaled(
        sw.severity === SEVERITY.HIGH ? SCORE_WEIGHTS.sweetenerHigh : SCORE_WEIGHTS.additiveModerate,
        'sweetener'
      ),
      sw.note?.es || '',
      sw.note?.en || '',
      sw.severity,
      'sweetener',
      sw.note
    );
  }

  for (const sw of findMatches(ingredientsText, ALLOWED_SWEETENERS)) {
    positives.push(
      buildAlert(
        'sweetener_ok',
        SEVERITY.INFO,
        sw.label,
        { en: 'Natural low-calorie sweetener on your approved list.', es: 'Edulcorante natural de baja caloría en tu lista aprobada.' },
        lang
      )
    );
  }

  for (const add of uniqueById(findAdditiveMatches(ingredientsText, product.additives_tags))) {
    if (!add.label?.es && !add.label?.en) continue;
    const w =
      add.severity === SEVERITY.HIGH
        ? SCORE_WEIGHTS.additiveHigh
        : add.severity === SEVERITY.MODERATE
          ? SCORE_WEIGHTS.additiveModerate
          : SCORE_WEIGHTS.additiveLow;
    penalize(
      `add-${add.id}`,
      add.label.es,
      add.label.en,
      scaled(w, 'additive'),
      add.note?.es || '',
      add.note?.en || '',
      add.severity,
      'additive',
      add.note
    );
  }

  const nutriments = product.nutriments || {};
  const sugars =
    nutriments['added-sugars_100g'] ??
    nutriments['sugars-added_100g'] ??
    nutriments.sugars_100g ??
    nutriments.sugars;
  const carbs =
    nutriments.carbohydrates_100g ??
    nutriments.carbohydrates ??
    nutriments['carbohydrates_serving'];
  const satFat =
    nutriments['saturated-fat_100g'] ??
    nutriments.saturated_fat_100g ??
    nutriments['saturated-fat'];
  const sodium = nutriments.sodium_100g ?? (nutriments.sodium ? nutriments.sodium * 1000 : null);

  if (sugars != null) {
    if (sugars > 22) {
      penalize(
        'high_sugar',
        `Muy alto en azúcares (${sugars}g/100g)`,
        `Very high sugars (${sugars}g/100g)`,
        scaled(SCORE_WEIGHTS.highSugarHigh, 'nutrition_sugar'),
        'Supera 22g por 100g (dato nutricional).',
        'Exceeds 22g per 100g (nutrition data).',
        SEVERITY.HIGH,
        'nutrition_sugar',
        { es: 'Incluye azúcares totales / añadidos si la base los reporta.', en: 'Includes total/added sugars when the DB reports them.' }
      );
    } else if (sugars > 12) {
      penalize(
        'high_sugar',
        `Alto en azúcares (${sugars}g/100g)`,
        `High sugars (${sugars}g/100g)`,
        scaled(SCORE_WEIGHTS.highSugar, 'nutrition_sugar'),
        'Supera 12g por 100g (dato nutricional).',
        'Exceeds 12g per 100g (nutrition data).',
        SEVERITY.MODERATE,
        'nutrition_sugar',
        { es: 'Incluye azúcares totales / añadidos si la base los reporta.', en: 'Includes total/added sugars when the DB reports them.' }
      );
    } else if (sugars > 5) {
      penalize(
        'mild_sugar',
        `Azúcares moderados (${sugars}g/100g)`,
        `Moderate sugars (${sugars}g/100g)`,
        scaled(SCORE_WEIGHTS.highSugarMild, 'nutrition_sugar'),
        'Entre 5 y 12g por 100g.',
        'Between 5 and 12g per 100g.',
        SEVERITY.LOW,
        'nutrition_sugar',
        { es: 'Dato nutricional de Open Food Facts / USDA.', en: 'Nutrient data from Open Food Facts / USDA.' }
      );
    }
  }

  if (carbs != null) {
    if (carbs > 60) {
      penalize(
        'very_high_carbs',
        `Muy alto en carbohidratos (${carbs}g/100g)`,
        `Very high carbohydrates (${carbs}g/100g)`,
        scaled(SCORE_WEIGHTS.veryHighCarbs, 'nutrition_carbs'),
        'Supera 60g de carbohidratos por 100g.',
        'Exceeds 60g carbohydrates per 100g.',
        SEVERITY.MODERATE,
        'nutrition_carbs',
        { es: 'Útil si priorizas bajo carb / control glucémico.', en: 'Useful if you prioritize low-carb / glucose control.' }
      );
    } else if (carbs > 40) {
      penalize(
        'high_carbs',
        `Alto en carbohidratos (${carbs}g/100g)`,
        `High carbohydrates (${carbs}g/100g)`,
        scaled(SCORE_WEIGHTS.highCarbs, 'nutrition_carbs'),
        'Supera 40g de carbohidratos por 100g.',
        'Exceeds 40g carbohydrates per 100g.',
        SEVERITY.LOW,
        'nutrition_carbs',
        { es: 'Útil si priorizas bajo carb / control glucémico.', en: 'Useful if you prioritize low-carb / glucose control.' }
      );
    }
  }

  if (satFat != null && satFat > 10) {
    penalize(
      'high_sat_fat',
      `Alto en grasas saturadas (${satFat}g/100g)`,
      `High saturated fat (${satFat}g/100g)`,
      scaled(SCORE_WEIGHTS.highSatFat, 'nutrition_satfat'),
      'Supera 10g de grasa saturada por 100g.',
      'Exceeds 10g saturated fat per 100g.',
      SEVERITY.MODERATE,
      'nutrition_satfat',
      { es: 'Default más suave — súbelo si te preocupa el corazón.', en: 'Softer default — raise it if heart health is a priority.' }
    );
  }

  if (sodium != null && sodium > 600) {
    penalize(
      'high_sodium',
      `Alto en sodio (${Math.round(sodium)}mg/100g)`,
      `High sodium (${Math.round(sodium)}mg/100g)`,
      scaled(SCORE_WEIGHTS.highSodium, 'nutrition_sodium'),
      'Supera 600mg por 100g según datos OFF.',
      'Exceeds 600mg per 100g per OFF data.',
      SEVERITY.MODERATE,
      'nutrition_sodium',
      { es: 'Dato nutricional de Open Food Facts.', en: 'Nutrient data from Open Food Facts.' }
    );
  }

  const protein =
    nutriments.proteins_100g ??
    nutriments.protein_100g ??
    nutriments.proteins ??
    nutriments.protein;
  const fiber =
    nutriments.fiber_100g ??
    nutriments['fiber'] ??
    nutriments['dietary-fiber_100g'] ??
    nutriments['dietary_fiber_100g'];

  // Aspectos positivos (sin sumar puntos — ya están incluidos en la base 100)
  if (isCleanProfile || upfTier === 'clean_label') {
    for (const signal of profileWholeFoods) {
      positives.push(
        buildAlert('whole_food', SEVERITY.INFO, signal.label, {
          en: 'Recognizable whole-food ingredient.',
          es: 'Ingrediente reconocible de alimento real.',
        }, lang)
      );
    }
  }

  let { score, breakdown } = ledger.finalize();

  if (novaGroup === 4 && categoryMultiplier(weights, 'nova') > 0) {
    const cap =
      upfTier === 'classic'
        ? SCORE_WEIGHTS.upfNova4CapClassic
        : upfTier === 'clean_label'
          ? SCORE_WEIGHTS.upfNova4CapClean
          : SCORE_WEIGHTS.upfNova4CapStandard;
    // Higher user weight → stricter ceiling; lower → softer
    const m = categoryMultiplier(weights, 'nova');
    const adjustedCap = Math.round(Math.min(95, Math.max(25, cap + (1 - m) * 12)));
    if (score > adjustedCap) {
      const tierEs = upfTierLabel(upfTier, 'es');
      const tierEn = upfTierLabel(upfTier, 'en');
      applyCap(
        'upf_cap',
        adjustedCap,
        'Ultraprocesado (NOVA 4)',
        'Ultra-processed (NOVA 4)',
        tierEs
          ? `Formulación industrial · ${tierEs}. Techo ${adjustedCap}/100.`
          : `Formulación industrial. Techo ${adjustedCap}/100.`,
        tierEn
          ? `Industrial formulation · ${tierEn}. Ceiling ${adjustedCap}/100.`
          : `Industrial formulation. Ceiling ${adjustedCap}/100.`
      );
      ({ score, breakdown } = ledger.finalize());
    }
  }

  // Bonos: proteína y fibra (después del techo UPF para que sí sumen)
  if (protein != null) {
    if (protein >= 20) {
      reward(
        'bonus_protein',
        `Buena proteína (${protein}g/100g)`,
        `Good protein (${protein}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusProteinHigh, 'nutrition_protein'),
        '≥20g proteína por 100g — bono.',
        '≥20g protein per 100g — bonus.'
      );
    } else if (protein >= 15) {
      reward(
        'bonus_protein',
        `Proteína sólida (${protein}g/100g)`,
        `Solid protein (${protein}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusProtein, 'nutrition_protein'),
        '≥15g proteína por 100g — bono.',
        '≥15g protein per 100g — bonus.'
      );
    } else if (protein >= 10) {
      reward(
        'bonus_protein',
        `Aporte de proteína (${protein}g/100g)`,
        `Protein contribution (${protein}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusProteinMild, 'nutrition_protein'),
        '≥10g proteína por 100g — bono.',
        '≥10g protein per 100g — bonus.'
      );
    }
  }

  if (fiber != null) {
    if (fiber >= 10) {
      reward(
        'bonus_fiber',
        `Alta fibra (${fiber}g/100g)`,
        `High fiber (${fiber}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusFiberHigh, 'nutrition_fiber'),
        '≥10g fibra por 100g — bono.',
        '≥10g fiber per 100g — bonus.'
      );
    } else if (fiber >= 6) {
      reward(
        'bonus_fiber',
        `Buena fibra (${fiber}g/100g)`,
        `Good fiber (${fiber}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusFiber, 'nutrition_fiber'),
        '≥6g fibra por 100g — bono.',
        '≥6g fiber per 100g — bonus.'
      );
    } else if (fiber >= 3) {
      reward(
        'bonus_fiber',
        `Aporte de fibra (${fiber}g/100g)`,
        `Fiber contribution (${fiber}g/100g)`,
        scaled(SCORE_WEIGHTS.bonusFiberMild, 'nutrition_fiber'),
        '≥3g fibra por 100g — bono.',
        '≥3g fiber per 100g — bonus.'
      );
    }
  }

  ({ score, breakdown } = ledger.finalize());

  const allergyMatch = matchAllergies(product, ingredientsText, allergies, lang);
  let allergyRisk = allergyMatch.allergyRisk;
  let allergyHits = allergyMatch.hits;

  if (allergyRisk) {
    const names = allergyHits.map((h) => h.label).join(', ');
    const delta = score; // bring score to 0
    if (delta > 0) {
      ledger.lines.push({
        id: 'allergy_risk',
        label: L(lang, 'Riesgo de alergia / evitar', 'Allergy / avoid risk'),
        delta: -delta,
        reason: L(
          lang,
          `Coincide con tu lista: ${names}. Nota automática = 0.`,
          `Matches your list: ${names}. Score forced to 0.`
        ),
      });
      ledger.total = 0;
    }
    score = 0;
    breakdown = ledger.lines;
    alerts.unshift(
      buildAlert(
        'allergy',
        SEVERITY.CRITICAL,
        L(lang, `ALERGIA / EVITAR: ${names}`, `ALLERGY / AVOID: ${names}`),
        {
          es: 'Marcado por tu lista personal. No consumas si es una alergia confirmada; verifica siempre la etiqueta.',
          en: 'Flagged by your personal list. Do not consume if this is a confirmed allergy; always verify the label.',
        },
        lang
      )
    );
  }

  const { grade, gradeColor } = allergyRisk
    ? {
        grade: lang === 'es' ? 'Riesgo alergia' : 'Allergy risk',
        gradeColor: 'avoid',
      }
    : computeGrade(score, lang);

  const verdict = buildVerdict(lang, {
    isCleanProfile,
    isProcessedMeat,
    seedOils,
    addedSugars,
    wholeFoodSignals: profileWholeFoods,
    alerts,
    positives,
    ultraProcessedItems,
  });

  if (allergyRisk) {
    const names = allergyHits.map((h) => h.label).join(', ');
    verdict.bad.unshift(
      L(lang, `Contiene / puede contener: ${names}`, `Contains / may contain: ${names}`)
    );
  }

  const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  return {
    score,
    grade,
    gradeColor,
    novaGroup,
    upfTier,
    upfTierLabel: upfTierLabel(upfTier, lang),
    isProcessedMeat,
    isCleanProfile,
    ultraProcessedItems,
    bioengineeredItems,
    goodPoints: verdict.good,
    badPoints: verdict.bad,
    scoreBreakdown: breakdown,
    alerts: uniqueById(alerts.map((a, i) => ({ ...a, id: `${a.category}-${i}` }))),
    positives,
    summary: allergyRisk
      ? L(
          lang,
          `0/100 — riesgo por tu lista de alergias/evitar (${allergyHits.map((h) => h.label).join(', ')}).`,
          `0/100 — risk from your allergy/avoid list (${allergyHits.map((h) => h.label).join(', ')}).`
        )
      : buildSummary(score, novaGroup, isProcessedMeat, isCleanProfile, verdict, lang),
    rulesVersion: '2.6.0',
    needsIngredients: false,
    allergyRisk,
    allergyHits,
  };
}

function buildSummary(score, novaGroup, isProcessedMeat, isCleanProfile, verdict, lang) {
  if (lang === 'es') {
    return `${score}/100 — base 100 menos solo lo negativo. Revisa desglose y lo bueno/malo.`;
  }
  return `${score}/100 — base 100 minus negatives only. See breakdown and good/bad lists.`;
}
