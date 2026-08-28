/**
 * VerdiScan Health Rules Engine
 * Based on: NOVA classification (Monteiro et al.), NutriNet-Santé cohort studies,
 * WHO guidance on non-sugar sweeteners, Frontiers 2026 review on food additives in UPF.
 * Sources documented in README.
 */
export const RULES_VERSION = '1.0.0';

export const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MODERATE: 'moderate',
  LOW: 'low',
  INFO: 'info',
};

/** NOVA group 4 markers — substances rarely used in domestic kitchens */
export const NOVA4_MARKERS = [
  { id: 'hfcs', patterns: [/high[\s-]?fructose\s+corn\s+syrup/i, /jarabe\s+de\s+ma[ií]z\s+alto\s+en\s+fructosa/i, /glucosa\s*-\s*fructosa/i, /jarabe\s+de\s+glucosa/i], label: { en: 'High-fructose corn syrup', es: 'Jarabe de maíz alto en fructosa' } },
  { id: 'maltodextrin', patterns: [/maltodextrin/i, /maltodextrina/i], label: { en: 'Maltodextrin', es: 'Maltodextrina' } },
  { id: 'hydrogenated_oil', patterns: [/hydrogenated/i, /interesterified/i, /hidrogenad/i, /interesterificad/i], label: { en: 'Hydrogenated / interesterified oils', es: 'Aceites hidrogenados / interesterificados' } },
  { id: 'modified_starch', patterns: [/modified\s+(corn\s+)?starch/i, /almid[oó]n\s+modificad/i], label: { en: 'Modified starch', es: 'Almidón modificado' } },
  { id: 'protein_isolate', patterns: [/soy\s+protein\s+isolate/i, /isolated?\s+soy\s+protein/i, /prote[ií]na\s+aislad[ao]\s+de\s+soya/i, /whey\s+protein/i, /casein/i, /case[ií]na/i, /gluten(?!\s+free)/i, /hydrolysed?\s+protein/i, /prote[ií]na\s+hidrolizad/i], label: { en: 'Industrial protein isolates', es: 'Proteínas aisladas industriales' } },
  { id: 'invert_sugar', patterns: [/invert\s+sugar/i, /az[uú]car\s+invertid/i], label: { en: 'Invert sugar', es: 'Azúcar invertido' } },
  { id: 'mechanically_separated', patterns: [/mechanically\s+separated/i, /carne\s+mec[aá]nicamente\s+separad/i], label: { en: 'Mechanically separated meat', es: 'Carne mecánicamente separada' } },
  { id: 'fruit_concentrate', patterns: [/fruit\s+juice\s+concentrate/i, /concentrado\s+de\s+jugo\s+de\s+frut/i], label: { en: 'Fruit juice concentrate (as sweetener)', es: 'Concentrado de jugo (como edulcorante)' } },
];

/** Seed / industrial oils — flagged per user criteria & metabolic literature */
export const SEED_OILS = [
  { id: 'soy', patterns: [/soy\s*(bean)?\s*oil/i, /soya\s*oil/i, /aceite\s+de\s+soya/i, /aceite\s+de\s+soja/i], label: { en: 'Soybean oil', es: 'Aceite de soya/soja' } },
  { id: 'sunflower', patterns: [/sunflower\s*oil/i, /aceite\s+de\s+girasol/i], label: { en: 'Sunflower oil', es: 'Aceite de girasol' } },
  { id: 'canola', patterns: [/canola\s*oil/i, /rapeseed\s*oil/i, /aceite\s+de\s+canola/i, /aceite\s+de\s+colza/i, /aceite\s+de\s+n[aá]bar/i], label: { en: 'Canola / rapeseed oil', es: 'Aceite de canola/colza' } },
  { id: 'corn', patterns: [/corn\s*oil/i, /aceite\s+de\s+ma[ií]z/i], label: { en: 'Corn oil', es: 'Aceite de maíz' } },
  { id: 'safflower', patterns: [/safflower\s*oil/i, /aceite\s+de\s+c[aá]rtamo/i], label: { en: 'Safflower oil', es: 'Aceite de cártamo' } },
  { id: 'cottonseed', patterns: [/cottonseed\s*oil/i, /aceite\s+de\s+algod[oó]n/i], label: { en: 'Cottonseed oil', es: 'Aceite de algodón' } },
  { id: 'grapeseed', patterns: [/grapeseed\s*oil/i, /grape\s*seed\s*oil/i, /aceite\s+de\s+uva/i], label: { en: 'Grapeseed oil', es: 'Aceite de semilla de uva' } },
  { id: 'vegetable_oil_generic', patterns: [/vegetable\s*oil(?!\s*olive)/i, /aceite\s+vegetal(?!\s+de\s+oliva)/i, /aceites\s+vegetales/i], label: { en: 'Generic vegetable oil (often seed blend)', es: 'Aceite vegetal genérico (mezcla de semillas)' } },
];

/** Healthy fats — not flagged */
export const HEALTHY_FATS = [
  /olive\s*oil/i, /aceite\s+de\s+oliva/i, /extra\s*virgin/i,
  /avocado\s*oil/i, /aceite\s+de\s+aguacate/i,
  /coconut\s*oil/i, /aceite\s+de\s+coco/i,
  /butter/i, /mantequilla/i, /ghee/i,
];

/** Sweeteners flagged — all except stevia & monk fruit per user spec */
export const FLAGGED_SWEETENERS = [
  { id: 'aspartame', patterns: [/aspartame/i, /aspartamo/i, /\be951\b/i], eNumber: 'E951', label: { en: 'Aspartame', es: 'Aspartamo' }, severity: SEVERITY.HIGH, note: { en: 'IARC Group 2B (possibly carcinogenic). Linked to metabolic & neurological concerns in recent reviews.', es: 'IARC Grupo 2B (posiblemente cancerígeno). Asociado a preocupaciones metabólicas y neurológicas en revisiones recientes.' } },
  { id: 'sucralose', patterns: [/sucralose/i, /sucralosa/i, /\be955\b/i], eNumber: 'E955', label: { en: 'Sucralose', es: 'Sucralosa' }, severity: SEVERITY.HIGH, note: { en: 'May alter gut microbiome and glucose metabolism (NutriNet-Santé, Frontiers 2026).', es: 'Puede alterar microbioma intestinal y metabolismo de glucosa (NutriNet-Santé, Frontiers 2026).' } },
  { id: 'acesulfame', patterns: [/acesulfame/i, /acesulfamo/i, /ace\s*-?\s*k/i, /\be950\b/i], eNumber: 'E950', label: { en: 'Acesulfame-K', es: 'Acesulfamo-K' }, severity: SEVERITY.HIGH, note: { en: 'Associated with metabolic disruption in cohort studies. WHO advises against NNS for weight control.', es: 'Asociado a alteraciones metabólicas en estudios de cohorte. OMS desaconseja edulcorantes para control de peso.' } },
  { id: 'saccharin', patterns: [/saccharin/i, /sacarina/i, /\be954\b/i], eNumber: 'E954', label: { en: 'Saccharin', es: 'Sacarina' }, severity: SEVERITY.HIGH, note: { en: 'Linked to gut dysbiosis and glucose intolerance in animal/human studies.', es: 'Vinculado a disbiosis intestinal e intolerancia a glucosa en estudios.' } },
  { id: 'neotame', patterns: [/neotame/i, /neotamo/i, /\be961\b/i], eNumber: 'E961', label: { en: 'Neotame', es: 'Neotamo' }, severity: SEVERITY.HIGH, note: { en: 'Synthetic sweetener; limited long-term human data.', es: 'Edulcorante sintético; datos humanos a largo plazo limitados.' } },
  { id: 'advantame', patterns: [/advantame/i, /advantamo/i, /\be969\b/i], eNumber: 'E969', label: { en: 'Advantame', es: 'Advantamo' }, severity: SEVERITY.HIGH, note: { en: 'Ultra-potent synthetic sweetener.', es: 'Edulcorante sintético ultra-potente.' } },
  { id: 'cyclamate', patterns: [/cyclamate/i, /ciclamato/i, /\be952\b/i], eNumber: 'E952', label: { en: 'Cyclamate', es: 'Ciclamato' }, severity: SEVERITY.MODERATE, note: { en: 'Banned in USA since 1969; still used in Mexico.', es: 'Prohibido en EE.UU. desde 1969; aún usado en México.' } },
  { id: 'sorbitol_excess', patterns: [], eNumber: null, label: { en: 'Sugar alcohols (info)', es: 'Alcoholes de azúcar (info)' }, severity: SEVERITY.LOW, note: { en: 'Erythritol, maltitol etc. — digestive issues at high doses.', es: 'Eritritol, maltitol etc. — molestias digestivas en dosis altas.' } },
];

/** Allowed natural sweeteners */
export const ALLOWED_SWEETENERS = [
  { id: 'stevia', patterns: [/stevia/i, /steviol/i, /\be960\b/i], label: { en: 'Stevia', es: 'Stevia' } },
  { id: 'monk_fruit', patterns: [/monk\s*fruit/i, /l[uú]o\s*han\s*guo/i, /fruto\s+del\s+monje/i, /siraitia/i, /mogroside/i], label: { en: 'Monk fruit', es: 'Fruto del monje' } },
];

/** Additives with emerging health concerns — NutriNet-Santé, Food Chem Toxicol 2024 */
export const CONCERNING_ADDITIVES = [
  { id: 'e471', eNumbers: ['e471'], patterns: [/mono[\s-]?and\s+diglycerides/i, /monoglic[eé]ridos/i, /diglic[eé]ridos/i], label: { en: 'E471 — Mono/diglycerides', es: 'E471 — Monoglicéridos/diglicéridos' }, severity: SEVERITY.HIGH, note: { en: 'NutriNet-Santé: associated with overall, breast & prostate cancer risk.', es: 'NutriNet-Santé: asociado con riesgo de cáncer general, mama y próstata.' } },
  { id: 'e407', eNumbers: ['e407', 'e407a'], patterns: [/carrageenan/i, /carragen/i], label: { en: 'E407 — Carrageenan', es: 'E407 — Carragenina' }, severity: SEVERITY.HIGH, note: { en: 'Linked to gut inflammation and breast cancer risk in cohort data.', es: 'Vinculado a inflamación intestinal y riesgo de cáncer de mama en cohortes.' } },
  { id: 'e250', eNumbers: ['e250', 'e249', 'e251', 'e252'], patterns: [/sodium\s+nitrite/i, /potassium\s+nitrite/i, /nitrit/i, /nitrat/i], label: { en: 'Nitrites / nitrates (E249-E252)', es: 'Nitritos / nitratos (E249-E252)' }, severity: SEVERITY.HIGH, note: { en: 'Processed meats — linked to colorectal cancer (WHO/IARC).', es: 'Carnes procesadas — vinculados a cáncer colorrectal (OMS/IARC).' } },
  { id: 'e120', eNumbers: ['e120'], patterns: [/carmine/i, /cochineal/i, /carmin/i, /carm[ií]n/i], label: { en: 'E120 — Carmine / cochineal', es: 'E120 — Carmín / cochinilla' }, severity: SEVERITY.MODERATE, note: { en: 'Genotoxic potential in cell studies (Food Chem Toxicol 2024).', es: 'Potencial genotóxico en estudios celulares (Food Chem Toxicol 2024).' } },
  { id: 'e102', eNumbers: ['e102', 'e104', 'e110', 'e122', 'e124', 'e129', 'e133', 'e142', 'e151'], patterns: [/tartrazine/i, /yellow\s*5/i, /yellow\s*6/i, /red\s*40/i, /allura\s*red/i, /sunset\s*yellow/i], label: { en: 'Synthetic food dyes', es: 'Colorantes alimentarios sintéticos' }, severity: SEVERITY.MODERATE, note: { en: 'Linked to hyperactivity in children (EFSA, FDA advisory). California Prop 65 warnings.', es: 'Vinculados a hiperactividad en niños (EFSA, FDA). Advertencias Prop 65 California.' } },
  { id: 'bha_bht', eNumbers: ['e320', 'e321'], patterns: [/\bbha\b/i, /\bbht\b/i, /butylated\s+hydroxy/i, /hidroxitolueno/i], label: { en: 'BHA / BHT (E320/E321)', es: 'BHA / BHT (E320/E321)' }, severity: SEVERITY.MODERATE, note: { en: 'Synthetic antioxidants; possible endocrine disruption.', es: 'Antioxidantes sintéticos; posible disruptor endocrino.' } },
  { id: 'e621', eNumbers: ['e621', 'e627', 'e631'], patterns: [/monosodium\s+glutamate/i, /glutamato\s+monos[oó]dico/i, /\bmsg\b/i], label: { en: 'MSG / glutamates (E621)', es: 'Glutamato monosódico (E621)' }, severity: SEVERITY.LOW, note: { en: 'Flavor enhancer; sensitivity reported in some individuals.', es: 'Potenciador de sabor; sensibilidad reportada en algunas personas.' } },
  { id: 'e466', eNumbers: ['e466'], patterns: [/carboxymethylcellulose/i, /carboximetilcelulosa/i], label: { en: 'E466 — CMC', es: 'E466 — CMC' }, severity: SEVERITY.MODERATE, note: { en: 'Emulsifier linked to gut microbiome disruption (Chassaing et al.).', es: 'Emulsificante vinculado a alteración del microbioma (Chassaing et al.).' } },
  { id: 'e433', eNumbers: ['e433'], patterns: [/polysorbate\s*80/i, /polisorbato\s*80/i], label: { en: 'E433/E433 — Polysorbate 80', es: 'E433 — Polisorbato 80' }, severity: SEVERITY.MODERATE, note: { en: 'Emulsifier associated with gut barrier disruption.', es: 'Emulsificante asociado a disrupción de barrera intestinal.' } },
  { id: 'e950_sweetener', eNumbers: [], patterns: [], label: { en: '', es: '' }, severity: SEVERITY.HIGH, note: { en: '', es: '' } },
];

/** Cosmetic additive classes per NOVA — presence suggests UPF */
export const COSMETIC_ADDITIVE_PREFIXES = [
  'en:emulsifier', 'en:colour', 'en:color', 'en:flavour', 'en:flavor',
  'en:sweetener', 'en:thickener', 'en:stabilizer', 'en:gelling-agent',
  'en:glazing-agent', 'en:anti-caking-agent', 'en:humectant', 'en:foaming-agent',
];

export const SCORE_WEIGHTS = {
  nova4: 25,
  seedOil: 15,
  sweetenerHigh: 20,
  additiveHigh: 12,
  additiveModerate: 6,
  additiveLow: 3,
  hfcs: 10,
  hydrogenated: 15,
  highSugar: 8,
  highSodium: 5,
};

export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function matchPatterns(text, patterns) {
  const normalized = normalizeText(text);
  return patterns.some((p) => p.test(normalized) || p.test(text));
}

export function findMatches(text, ruleList) {
  const found = [];
  for (const rule of ruleList) {
    if (rule.patterns?.length && matchPatterns(text, rule.patterns)) {
      found.push(rule);
    }
  }
  return found;
}

export function findAdditiveMatches(ingredientsText, additivesTags = []) {
  const found = [];
  const text = normalizeText(ingredientsText);
  const tagSet = new Set((additivesTags || []).map((t) => t.toLowerCase()));

  for (const additive of CONCERNING_ADDITIVES) {
    if (additive.patterns?.length && matchPatterns(text, additive.patterns)) {
      found.push(additive);
      continue;
    }
    if (additive.eNumbers?.length) {
      for (const e of additive.eNumbers) {
        if (tagSet.has(`en:${e}`) || text.includes(e)) {
          found.push(additive);
          break;
        }
      }
    }
  }
  return found;
}

export function detectNovaGroup(product, ingredientsText) {
  if (product.nova_group) return product.nova_group;

  const text = ingredientsText || '';
  const hasNova4Marker = findMatches(text, NOVA4_MARKERS).length > 0;
  const hasCosmeticAdditive = (product.additives_tags || []).some((t) =>
    COSMETIC_ADDITIVE_PREFIXES.some((p) => t.toLowerCase().includes(p.replace('en:', '')))
  );
  const hasFlaggedSweetener = findMatches(text, FLAGGED_SWEETENERS).length > 0;
  const additiveCount = (product.additives_n || product.additives_tags?.length || 0);

  if (hasNova4Marker || hasCosmeticAdditive || (additiveCount >= 3 && hasFlaggedSweetener)) return 4;
  if (additiveCount >= 1 || /salt|sugar|aceite|oil/i.test(text)) return 3;
  return null;
}
