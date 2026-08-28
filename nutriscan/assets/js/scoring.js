import {
  SEVERITY,
  SCORE_WEIGHTS,
  NOVA4_MARKERS,
  SEED_OILS,
  HEALTHY_FATS,
  FLAGGED_SWEETENERS,
  ALLOWED_SWEETENERS,
  findMatches,
  findAdditiveMatches,
  detectNovaGroup,
  normalizeText,
} from './rules.js';

const MAX_SCORE = 100;

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

export function analyzeProduct(product, lang = 'es') {
  const ingredientsText =
    product.ingredients_text_es ||
    product.ingredients_text_en ||
    product.ingredients_text ||
    '';
  const alerts = [];
  let penalty = 0;
  const positives = [];

  const novaGroup = detectNovaGroup(product, ingredientsText);

  if (novaGroup === 4) {
    penalty += SCORE_WEIGHTS.nova4;
    alerts.push(
      buildAlert(
        'nova',
        SEVERITY.CRITICAL,
        { en: 'Ultra-processed (NOVA 4)', es: 'Ultraprocesado (NOVA 4)' },
        {
          en: 'Industrial formulations with cosmetic additives, rarely used in home kitchens. Linked to obesity, diabetes & cardiovascular disease in epidemiological studies.',
          es: 'Formulaciones industriales con aditivos cosméticos, raramente usados en cocinas caseras. Vinculado a obesidad, diabetes y enfermedades cardiovasculares en estudios epidemiológicos.',
        },
        lang
      )
    );
  } else if (novaGroup === 3) {
    penalty += 8;
    alerts.push(
      buildAlert(
        'nova',
        SEVERITY.MODERATE,
        { en: 'Processed food (NOVA 3)', es: 'Alimento procesado (NOVA 3)' },
        {
          en: 'Canned, cured, or fermented with added salt/sugar/oil. Moderate processing.',
          es: 'Enlatado, curado o fermentado con sal/azúcar/aceite añadidos. Procesamiento moderado.',
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
        { en: 'Closer to whole food.', es: 'Más cercano a alimento integral.' },
        lang
      )
    );
  }

  const nova4Markers = findMatches(ingredientsText, NOVA4_MARKERS);
  for (const marker of nova4Markers) {
    if (marker.id === 'hfcs') penalty += SCORE_WEIGHTS.hfcs;
    if (marker.id === 'hydrogenated_oil') penalty += SCORE_WEIGHTS.hydrogenated;
    alerts.push(
      buildAlert(
        'nova_marker',
        marker.id === 'hydrogenated_oil' ? SEVERITY.CRITICAL : SEVERITY.HIGH,
        marker.label,
        {
          en: 'Industrial ingredient marker of ultra-processing (NOVA criteria).',
          es: 'Ingrediente industrial marcador de ultraprocesado (criterios NOVA).',
        },
        lang
      )
    );
  }

  const text = normalizeText(ingredientsText);
  const hasHealthyFat = HEALTHY_FATS.some((p) => p.test(text));
  const seedOils = findMatches(ingredientsText, SEED_OILS);
  for (const oil of seedOils) {
    penalty += SCORE_WEIGHTS.seedOil;
    alerts.push(
      buildAlert(
        'seed_oil',
        SEVERITY.HIGH,
        oil.label,
        {
          en: 'Refined seed oil — high omega-6, often oxidized in processing. Prefer olive, avocado, coconut or butter.',
          es: 'Aceite de semilla refinado — alto omega-6, a menudo oxidado en procesamiento. Prefiere oliva, aguacate, coco o mantequilla.',
        },
        lang
      )
    );
  }
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

  const flaggedSweeteners = findMatches(ingredientsText, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length));
  for (const sw of flaggedSweeteners) {
    penalty += sw.severity === SEVERITY.HIGH ? SCORE_WEIGHTS.sweetenerHigh : SCORE_WEIGHTS.additiveModerate;
    alerts.push(buildAlert('sweetener', sw.severity, sw.label, sw.note, lang));
  }

  const allowedSweeteners = findMatches(ingredientsText, ALLOWED_SWEETENERS);
  for (const sw of allowedSweeteners) {
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

  const additives = findAdditiveMatches(ingredientsText, product.additives_tags);
  for (const add of uniqueById(additives)) {
    const w =
      add.severity === SEVERITY.HIGH
        ? SCORE_WEIGHTS.additiveHigh
        : add.severity === SEVERITY.MODERATE
          ? SCORE_WEIGHTS.additiveModerate
          : SCORE_WEIGHTS.additiveLow;
    penalty += w;
    alerts.push(buildAlert('additive', add.severity, add.label, add.note, lang));
  }

  const nutriments = product.nutriments || {};
  const sugars = nutriments.sugars_100g ?? nutriments['sugars'];
  const sodium = nutriments.sodium_100g ?? (nutriments.sodium ? nutriments.sodium * 1000 : null);

  if (sugars != null && sugars > 15) {
    penalty += SCORE_WEIGHTS.highSugar;
    alerts.push(
      buildAlert(
        'nutrition',
        SEVERITY.MODERATE,
        { en: `High sugar (${sugars}g/100g)`, es: `Alto en azúcar (${sugars}g/100g)` },
        { en: 'Exceeds 15g sugar per 100g.', es: 'Supera 15g de azúcar por 100g.' },
        lang
      )
    );
  }

  if (sodium != null && sodium > 600) {
    penalty += SCORE_WEIGHTS.highSodium;
    alerts.push(
      buildAlert(
        'nutrition',
        SEVERITY.MODERATE,
        { en: `High sodium (${Math.round(sodium)}mg/100g)`, es: `Alto en sodio (${Math.round(sodium)}mg/100g)` },
        { en: 'Exceeds 600mg sodium per 100g.', es: 'Supera 600mg de sodio por 100g.' },
        lang
      )
    );
  }

  penalty = Math.min(penalty, 95);
  const score = Math.max(5, MAX_SCORE - penalty);

  let grade, gradeColor;
  if (score >= 75) {
    grade = lang === 'es' ? 'Excelente' : 'Excellent';
    gradeColor = 'excellent';
  } else if (score >= 55) {
    grade = lang === 'es' ? 'Aceptable' : 'Acceptable';
    gradeColor = 'good';
  } else if (score >= 35) {
    grade = lang === 'es' ? 'Precaución' : 'Caution';
    gradeColor = 'caution';
  } else {
    grade = lang === 'es' ? 'Evitar' : 'Avoid';
    gradeColor = 'avoid';
  }

  const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  return {
    score,
    grade,
    gradeColor,
    novaGroup,
    alerts: uniqueById(alerts.map((a, i) => ({ ...a, id: `${a.category}-${i}` }))),
    positives,
    summary: buildSummary(score, novaGroup, alerts, lang),
    rulesVersion: '1.0.0',
  };
}

function buildSummary(score, novaGroup, alerts, lang) {
  const critical = alerts.filter((a) => a.severity === SEVERITY.CRITICAL || a.severity === SEVERITY.HIGH);
  if (lang === 'es') {
    if (score >= 75) return 'Producto mayormente limpio según nuestros criterios.';
    if (novaGroup === 4) return `Ultraprocesado con ${critical.length} alerta(s) significativa(s).`;
    return `${critical.length} ingrediente(s) o aditivo(s) de preocupación detectados.`;
  }
  if (score >= 75) return 'Mostly clean product by our criteria.';
  if (novaGroup === 4) return `Ultra-processed with ${critical.length} significant alert(s).`;
  return `${critical.length} concerning ingredient(s) or additive(s) detected.`;
}
