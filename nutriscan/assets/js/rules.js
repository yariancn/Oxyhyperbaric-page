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
  { id: 'modified_starch', patterns: [/modified\s+(?:corn\s+|tapioca\s+|potato\s+)?starch/i, /almid[oó]n\s+modificad/i, /modified\s+tapioca/i], label: { en: 'Modified starch', es: 'Almidón modificado' } },
  { id: 'corn_starch', patterns: [/(?<!\bmodified\s)corn\s+starch/i, /almid[oó]n\s+de\s+ma[ií]z(?!\s+modificad)/i], label: { en: 'Corn starch', es: 'Almidón de maíz' } },
  { id: 'milk_protein_isolate', patterns: [/milk\s+protein\s+isolate/i, /prote[ií]na\s+aislad[ao]\s+de\s+leche/i], label: { en: 'Milk protein isolate', es: 'Proteína aislada de leche' } },
  { id: 'wheat_protein_isolate', patterns: [/wheat\s+protein\s+isolate/i, /prote[ií]na\s+aislad[ao]\s+de\s+trigo/i], label: { en: 'Wheat protein isolate', es: 'Proteína aislada de trigo' } },
  { id: 'soy_protein_isolate', patterns: [/soy\s+protein\s+isolate/i, /isolated?\s+soy\s+protein/i, /prote[ií]na\s+aislad[ao]\s+de\s+soya/i], label: { en: 'Soy protein isolate', es: 'Proteína aislada de soya' } },
  { id: 'whey_or_gluten', patterns: [/whey\s+protein/i, /wheat\s+gluten/i, /vital\s+wheat\s+gluten/i, /gluten\s+de\s+trigo/i, /prote[ií]na\s+de\s+suero/i], label: { en: 'Whey / gluten isolate', es: 'Suero / gluten aislado' } },
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
  {
    id: 'cultured_celery',
    patterns: [/cultured celery/i, /celery powder/i, /polvo de apio/i, /apio cultivado/i],
    label: { en: 'Cultured celery powder (nitrite source)', es: 'Apio cultivado en polvo (fuente de nitritos)' },
    severity: SEVERITY.MODERATE,
    note: {
      en: 'Natural nitrite source in cured meats — limit processed meat frequency.',
      es: 'Fuente “natural” de nitritos en carnes curadas — limitar carne procesada.',
    },
  },
];

/** Jerky / cured meat — processing markers */
export const JERKY_CONCERNS = [
  {
    id: 'collagen_casing',
    patterns: [/collagen casing/i, /colored collagen/i, /casing/i, /tripa de colageno/i],
    label: { en: 'Collagen casing (processed)', es: 'Tripa de colágeno (procesada)' },
    severity: SEVERITY.MODERATE,
    note: {
      en: 'Industrial casing, often colored — not part of whole meat.',
      es: 'Envoltura industrial, a menudo coloreada — no es carne íntegra.',
    },
  },
  {
    id: 'encapsulated_acid',
    patterns: [/encapsulated citric/i, /acido citrico encapsulado/i],
    label: { en: 'Encapsulated citric acid', es: 'Ácido cítrico encapsulado' },
    severity: SEVERITY.LOW,
    note: {
      en: 'Processing aid for texture/shelf life.',
      es: 'Auxiliar de procesamiento para textura/vida útil.',
    },
  },
];

export const ADDED_SUGAR_TERMS = [
  { id: 'sugar', pattern: /\b(?:brown\s+)?sugar\b|\baz[uú]car\b/i },
  { id: 'honey', pattern: /\bhoney\b|\bmiel\b/i },
  { id: 'molasses', pattern: /\bmolasses\b|\bmelaza\b/i },
  { id: 'corn_syrup', pattern: /corn syrup|jarabe de maiz/i },
  { id: 'dextrose', pattern: /\bdextrose\b|\bdextrosa\b/i },
];

export const PROCESSED_MEAT = {
  id: 'processed_meat',
  label: { en: 'Processed / cured meat', es: 'Carne procesada / curada' },
  note: {
    en: 'WHO Group 1: regular processed meat intake linked to colorectal cancer. Best as occasional food.',
    es: 'OMS Grupo 1: consumo regular de carne procesada vinculado a cáncer colorrectal. Mejor como alimento ocasional.',
  },
};

/** Cosmetic additive classes per NOVA — presence suggests UPF */
export const COSMETIC_ADDITIVE_PREFIXES = [
  'en:emulsifier', 'en:colour', 'en:color', 'en:flavour', 'en:flavor',
  'en:sweetener', 'en:thickener', 'en:stabilizer', 'en:gelling-agent',
  'en:glazing-agent', 'en:anti-caking-agent', 'en:humectant', 'en:foaming-agent',
];

/** Bioengineered disclosure + imitation / designed-to-look-like-real-food products */
export const BIOENGINEERED_MARKERS = [
  {
    id: 'bioengineered_label',
    patterns: [
      /bioengineered/i,
      /bioingenier/i,
      /derived from bioengineering/i,
      /derivad[oa]\s+de\s+bioingenier/i,
      /contains?\s+bioengineered/i,
      /contiene\s+(?:ingredientes?\s+)?bioingenier/i,
    ],
    label: { en: 'Bioengineered ingredients declared on label', es: 'Bioingeniería declarada en etiqueta' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'On-pack disclosure (US Bioengineered Food Disclosure Standard).',
      es: 'Declaración en empaque (norma de divulgación de alimentos bioingenierados en EE.UU.).',
    },
  },
  {
    id: 'gmo_text',
    patterns: [
      /genetically\s+modified/i,
      /gen[eé]ticamente\s+modificad/i,
      /\bgmo\b/i,
      /\bogm\b/i,
      /transg[eé]nic/i,
      /organismo\s+gen[eé]ticamente\s+modificad/i,
    ],
    label: { en: 'GMO / genetically modified mention', es: 'Mención de OGM / transgénico' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Label or ingredients explicitly mention genetic modification.',
      es: 'La etiqueta o ingredientes mencionan modificación genética de forma explícita.',
    },
  },
  {
    id: 'imitation_meat',
    patterns: [
      /plant[\s-]?based\s+(?:meat|beef|chicken|burger|sausage|hot\s*dog|bacon|ground)/i,
      /meat\s+alternative/i,
      /meat\s+analogue/i,
      /meat\s+substitute/i,
      /imitation\s+(?:meat|beef|chicken|bacon|crab|seafood)/i,
      /faux\s+(?:meat|beef|chicken)/i,
      /vegan\s+(?:meat|beef|chicken|chorizo|jam[oó]n|sausage|burger)/i,
      /carne\s+vegetal/i,
      /carne\s+de\s+origen\s+vegetal/i,
      /alternativa\s+(?:a\s+)?(?:la\s+)?carne/i,
      /imitaci[oó]n\s+de\s+carne/i,
      /an[aá]logo\s+(?:c[aá]rnico|de\s+carne)/i,
      /protein\s+from\s+plants.*(?:beef|chicken|meat)/i,
      /impossible\s+(?:burger|beef|sausage|chicken)/i,
      /beyond\s+(?:meat|beef|burger|sausage)/i,
    ],
    label: { en: 'Plant-based / imitation meat', es: 'Carne vegetal / imitación de carne' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Designed to look or taste like meat but is not conventional animal meat — usually declared on pack.',
      es: 'Diseñado para parecer o saber a carne, pero no es carne animal convencional — suele declararse en el empaque.',
    },
  },
  {
    id: 'imitation_dairy_egg',
    patterns: [
      /plant[\s-]?based\s+(?:milk|cheese|yogurt|egg|butter|cream)/i,
      /dairy[\s-]?free\s+(?:cheese|yogurt|milk|butter)/i,
      /imitation\s+(?:cheese|milk|cream|egg)/i,
      /egg\s+alternative/i,
      /egg\s+replacer/i,
      /vegan\s+(?:egg|cheese|butter|mayo)/i,
      /leche\s+vegetal/i,
      /queso\s+vegetal/i,
      /imitaci[oó]n\s+de\s+(?:queso|leche|huevo)/i,
      /alternativa\s+(?:a\s+)?(?:la\s+)?leche/i,
      /huevo\s+vegetal/i,
    ],
    label: { en: 'Plant-based / imitation dairy or egg', es: 'Lácteo o huevo vegetal / imitación' },
    severity: SEVERITY.MODERATE,
    note: {
      en: 'Formulated to mimic dairy or egg; check the label for plant-based / imitation claims.',
      es: 'Formulado para imitar lácteos o huevo; revisa en etiqueta “vegetal” / “imitación”.',
    },
  },
  {
    id: 'cultured_lab_meat',
    patterns: [
      /cultured\s+meat/i,
      /cell[\s-]?based\s+meat/i,
      /lab[\s-]?grown\s+meat/i,
      /carne\s+cultivada/i,
      /carne\s+de\s+laboratorio/i,
      /carne\s+celular/i,
    ],
    label: { en: 'Cultured / lab-grown meat', es: 'Carne cultivada / de laboratorio' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Cell-cultured product designed to resemble conventional meat.',
      es: 'Producto de cultivo celular diseñado para parecer carne convencional.',
    },
  },
];

/** Categories / labels that mark imitation or bioengineered products */
export const IMITATION_LABEL_TAGS = [
  'en:plant-based-meat',
  'en:meat-analogues',
  'en:meat-alternatives',
  'en:vegetarian-sausages',
  'en:vegan-sausages',
  'en:plant-based-cheeses',
  'en:vegan-cheeses',
  'en:meat-substitutes',
  'en:imitation',
];

export const BIOENGINEERED_LABEL_TAGS = [
  'en:contains-bioengineered-food-ingredients',
  'en:made-from-bioengineered-food',
  'en:bioengineered',
];

/** Artificial / “lab-made” ingredient markers */
export const ARTIFICIAL_MARKERS = [
  {
    id: 'artificial_flavor',
    patterns: [/artificial\s+flavou?r/i, /saborizante\s+artificial/i, /aroma\s+artificial/i, /sabor\s+artificial/i],
    label: { en: 'Artificial flavor', es: 'Saborizante artificial' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Synthetic flavor compounds — not from whole food sources.',
      es: 'Compuestos de sabor sintéticos — no provienen de alimentos integrales.',
    },
  },
  {
    id: 'natural_flavor',
    patterns: [/natural\s+(?:smoke\s+)?flavou?r/i, /saborizante\s+natural/i, /aroma\s+natural/i, /natural\s+smoke/i],
    label: { en: '"Natural flavor" (often processed)', es: '"Saborizante natural" (a menudo procesado)' },
    severity: SEVERITY.MODERATE,
    note: {
      en: 'Legally “natural” but usually lab-extracted or processed; exact source not disclosed.',
      es: 'Legalmente “natural” pero suele ser extracto de laboratorio; la fuente exacta no se declara.',
    },
  },
  {
    id: 'artificial_color',
    patterns: [/artificial\s+colou?r/i, /colorante\s+artificial/i, /artificial\s+dye/i],
    label: { en: 'Artificial color', es: 'Colorante artificial' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Synthetic petroleum-derived dyes.',
      es: 'Colorantes sintéticos derivados del petróleo.',
    },
  },
  {
    id: 'artificial_sweetener_generic',
    patterns: [/artificial\s+sweetener/i, /edulcorante\s+artificial/i],
    label: { en: 'Artificial sweetener (declared)', es: 'Edulcorante artificial (declarado)' },
    severity: SEVERITY.HIGH,
    note: {
      en: 'Non-nutritive synthetic sweetener on label.',
      es: 'Edulcorante sintético no calórico en etiqueta.',
    },
  },
];

export const NON_GMO_LABELS = [
  'en:non-gmo-project-verified',
  'en:no-gmos',
  'en:gmo-free',
  'en:organic',
  'en:usda-organic',
  'en:ab-agriculture-biologique',
];

export const SCORE_WEIGHTS = {
  /** Small contextual modifiers — NOVA labels processing level, not a flat -50 */
  nova3Processed: 4,
  nova4CleanLabel: 10,
  nova4Standard: 14,
  nova4Classic: 22,
  nova4MarkerClassic: 4,
  nova4MarkerClean: 2,
  /** Protein isolates / whey — lighter than generic industrial markers */
  nova4ProteinIsolate: 3,
  seedOil: 14,
  sweetenerHigh: 18,
  additiveHigh: 10,
  additiveModerate: 5,
  additiveLow: 2,
  hfcs: 12,
  hydrogenated: 14,
  bioengineeredHigh: 12,
  bioengineeredModerate: 6,
  bioengineeredModerateClean: 3,
  artificialHigh: 12,
  artificialModerate: 5,
  artificialModerateClean: 3,
  highSugar: 8,
  highSugarMild: 4,
  highSugarHigh: 12,
  highCarbs: 6,
  veryHighCarbs: 10,
  highSatFat: 6,
  highSodium: 5,
  /** Bonos nutricionales (suman puntos) */
  bonusProteinMild: 4,
  bonusProtein: 6,
  bonusProteinHigh: 8,
  bonusFiberMild: 3,
  bonusFiber: 5,
  bonusFiberHigh: 8,
  processedMeat: 14,
  multipleAddedSugars: 8,
  addedSugarExtra: 2,
  jerkyConcernModerate: 4,
  jerkyConcernLow: 2,
  bonusCleanProfile: 6,
  bonusRealProteinFirst: 4,
  bonusNoSeedOil: 3,
  bonusNoArtificialSweetener: 3,
  additiveCountThreshold: 6,
  upfAdditiveCluster: 5,
  /** Techos NOVA 4: ultraprocesado no puede ser “Excelente” */
  upfNova4CapClean: 58,
  upfNova4CapStandard: 48,
  upfNova4CapClassic: 40,
  /** Sin lista de ingredientes no se puntúa (se pide al usuario) */
  missingIngredientsBlock: true,
  /** Huevos / carne / lácteos sin etiqueta libre de antibióticos u orgánica */
  conventionalAnimal: 16,
  unknownHusbandry: 5,
};

/** Claims that indicate better animal husbandry / no routine antibiotics */
export const ANTIBIOTIC_FREE_LABELS = [
  'en:no-antibiotics',
  'en:antibiotic-free',
  'en:raised-without-antibiotics',
  'en:without-antibiotics',
  'en:organic',
  'en:usda-organic',
  'en:ab-agriculture-biologique',
  'en:pasture-raised',
  'en:grass-fed',
  'en:free-range',
  'en:cage-free',
];

export const ANTIBIOTIC_FREE_TEXT = [
  /antibiotic[\s-]?free/i,
  /raised\s+without\s+antibiotics/i,
  /sin\s+antibiot/i,
  /libre\s+de\s+antibiot/i,
  /criado\s+sin\s+antibiot/i,
  /usda\s+organic/i,
  /\borganic\b/i,
  /\borganico\b/i,
  /pasture[\s-]?raised/i,
  /pastoreo/i,
  /grass[\s-]?fed/i,
  /alimentad[oa]s?\s+con\s+pasto/i,
  /free[\s-]?range/i,
  /cage[\s-]?free/i,
  /libre\s+de\s+jaula/i,
  /gallina\s+feliz/i,
];

/** Detect eggs / poultry / conventional animal products needing husbandry check */
export function detectAnimalProduct(product, ingredientsText) {
  const name = `${product.product_name || ''} ${product.product_name_es || ''} ${product.brands || ''}`;
  const cats = (product.categories_tags || []).join(' ');
  const text = `${name} ${cats} ${ingredientsText || ''}`;
  const n = normalizeText(text);

  const isEgg =
    /\bhuevos?\b|\beggs?\b|en:eggs|en:chicken-eggs|en:fresh-eggs/.test(n) ||
    /en:eggs/.test(cats);
  const isPoultry =
    /\bpollo\b|\bchicken\b|\bpavo\b|\bturkey\b|en:chickens|en:poultry/.test(n);
  const isMeat =
    /\bcarne\b|\bbeef\b|\bpork\b|\bres\b|\bcerdo\b|en:meats|en:fresh-meats/.test(n);
  const isDairy =
    /\bleche\b|\bmilk\b|\byogur|\byogurt|\bqueso\b|\bcheese\b|\bjocoque\b|en:dairies|en:milks|en:yogurts|en:cheeses/.test(
      n
    );

  if (isEgg) return { kind: 'egg', label: { es: 'Huevos', en: 'Eggs' } };
  if (isPoultry) return { kind: 'poultry', label: { es: 'Aves', en: 'Poultry' } };
  if (isMeat) return { kind: 'meat', label: { es: 'Carne', en: 'Meat' } };
  if (isDairy) return { kind: 'dairy', label: { es: 'Lácteos', en: 'Dairy' } };
  return null;
}

export function hasAntibioticFreeClaim(product, ingredientsText) {
  const labels = product.labels_tags || [];
  if (labels.some((t) => ANTIBIOTIC_FREE_LABELS.includes(t))) return true;

  const blob = [
    product.product_name,
    product.product_name_es,
    product.brands,
    ingredientsText,
    (product.labels_tags || []).join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  return ANTIBIOTIC_FREE_TEXT.some((p) => p.test(blob));
}

/** Whole-food signals common in “clean label” packaged snacks */
export const WHOLE_FOOD_SIGNALS = [
  {
    id: 'animal_protein',
    patterns: [
      /^beef\b|^pork\b|^turkey\b|^chicken\b|^bison\b|^venison\b|^res\b|^cerdo\b|^pollo\b|^carne\b/i,
      /chicken|beef|pork|turkey|salmon|tuna|egg|huevo|pollo|carne|pavo|cerdo|atun|higado|liver|bone broth|caldo/i,
    ],
    label: { en: 'Real animal protein', es: 'Proteína animal real' },
  },
  {
    id: 'dairy',
    patterns: [/cheese|queso|milk|leche|butter|mantequilla|yogurt|yogur|cheddar|gouda/i],
    label: { en: 'Real dairy', es: 'Lácteos reales' },
  },
  {
    id: 'ferment',
    patterns: [/sourdough|masa madre|live active/i],
    label: { en: 'Fermented / live cultures', es: 'Fermentado / cultivos vivos' },
  },
  {
    id: 'nuts_seeds',
    patterns: [/almond|almendra|walnut|nuez|pecan|cashew|maranon|seed(?! oil)/i],
    label: { en: 'Nuts or seeds', es: 'Frutos secos o semillas' },
  },
];

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

export function findAllNova4Hits(text) {
  const hits = [];
  const seen = new Set();
  for (const marker of NOVA4_MARKERS) {
    for (const pattern of marker.patterns || []) {
      if (matchPatterns(text, [pattern])) {
        const key = marker.id;
        if (!seen.has(key)) {
          seen.add(key);
          hits.push(marker);
        }
        break;
      }
    }
  }
  return hits;
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

export function countAddedSweetenerTypes(text) {
  const found = [];
  for (const term of ADDED_SUGAR_TERMS) {
    if (term.pattern.test(text || '')) found.push(term.id);
  }
  return found;
}

export function isSimpleProcessedMeat(text) {
  const t = (text || '').trim();
  if (!/^(beef|pork|turkey|chicken|bison|venison|carne|res|cerdo|pollo|pavo)\b/i.test(t)) return false;
  if (findMatches(t, NOVA4_MARKERS).length > 0) return false;
  if (findMatches(t, SEED_OILS).length > 0) return false;
  if (findMatches(t, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length)).length > 0) return false;
  return /cultured celery|celery powder|collagen|smoke flavor|encapsulated citric|nitrit|jerky|meat stick|sausage|salami|bacon/i.test(
    t
  );
}

export function detectProcessedMeat(text) {
  return isSimpleProcessedMeat(text);
}

export function detectNovaGroup(product, ingredientsText) {
  const text = ingredientsText || '';

  if (isSimpleProcessedMeat(text)) return 3;

  const nova4Markers = findMatches(text, NOVA4_MARKERS);
  const additiveCount = product.additives_n ?? product.additives_tags?.length ?? 0;
  const hasFlaggedSweetener = findMatches(text, FLAGGED_SWEETENERS).length > 0;
  const hasArtificial = findMatches(text, ARTIFICIAL_MARKERS.filter((m) => m.severity === SEVERITY.HIGH)).length > 0;
  const hasCosmeticAdditive = (product.additives_tags || []).some((t) => {
    const tag = t.toLowerCase();
    return COSMETIC_ADDITIVE_PREFIXES.some((p) => tag.includes(p.replace('en:', '')));
  });

  const inferredNova4 =
    nova4Markers.length > 0 ||
    hasCosmeticAdditive ||
    additiveCount >= 4 ||
    (additiveCount >= 2 && (hasFlaggedSweetener || hasArtificial)) ||
    findMatches(text, ARTIFICIAL_MARKERS).length >= 2;

  if (product.nova_group === 4 || inferredNova4) return 4;
  if (product.nova_group) return product.nova_group;
  if (additiveCount >= 1 || /salt|sugar|aceite|oil/i.test(text)) return 3;
  return null;
}

export function collectUltraProcessedIndicators(product, ingredientsText, lang = 'es') {
  const indicators = [];
  const text = ingredientsText || '';
  const label = (item) => (typeof item.label === 'object' ? item.label[lang] || item.label.en : item.label);

  for (const marker of findAllNova4Hits(text)) {
    indicators.push({ type: 'nova_marker', label: label(marker), id: marker.id });
  }

  for (const add of findAdditiveMatches(text, product.additives_tags)) {
    if (add.label?.en || add.label?.es) {
      indicators.push({ type: 'additive', label: label(add), id: add.id });
    }
  }

  for (const sw of findMatches(text, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length))) {
    indicators.push({ type: 'sweetener', label: label(sw), id: sw.id });
  }

  for (const art of findMatches(text, ARTIFICIAL_MARKERS)) {
    indicators.push({ type: 'artificial', label: label(art), id: art.id });
  }

  for (const concern of findMatches(text, JERKY_CONCERNS)) {
    indicators.push({ type: 'jerky', label: label(concern), id: concern.id });
  }

  if (detectProcessedMeat(text)) {
    indicators.push({
      type: 'processed_meat',
      id: 'processed_meat',
      label: label(PROCESSED_MEAT),
    });
  }

  const addedSugars = countAddedSweetenerTypes(text);
  if (addedSugars.length >= 2) {
    indicators.push({
      type: 'added_sugar',
      id: 'multiple_sugars',
      label:
        lang === 'es'
          ? `${addedSugars.length} tipos de azúcar añadida (${addedSugars.join(', ')})`
          : `${addedSugars.length} added sugar types (${addedSugars.join(', ')})`,
    });
  }

  const additiveCount = product.additives_n ?? product.additives_tags?.length ?? 0;
  if (additiveCount >= 4 && indicators.every((i) => i.type !== 'additive_count')) {
    indicators.push({
      type: 'additive_count',
      id: 'many_additives',
      label:
        lang === 'es'
          ? `${additiveCount} aditivos declarados (patrón ultraprocesado)`
          : `${additiveCount} declared additives (ultra-processed pattern)`,
    });
  }

  const seen = new Set();
  return indicators.filter((item) => {
    const key = `${item.type}-${item.id}-${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectBioengineered(product, ingredientsText, lang = 'es') {
  const findings = [];
  const labels = (product.labels_tags || []).map((t) => t.toLowerCase());
  const categories = (product.categories_tags || []).map((t) => t.toLowerCase());
  const nameBlob = `${product.product_name || ''} ${product.generic_name || ''} ${ingredientsText || ''}`;
  const label = (item) => (typeof item.label === 'object' ? item.label[lang] || item.label.en : item.label);

  for (const tag of BIOENGINEERED_LABEL_TAGS) {
    if (labels.includes(tag) || labels.some((l) => l.includes('bioengineered'))) {
      findings.push({
        id: 'bioengineered_pack_label',
        severity: SEVERITY.HIGH,
        label:
          lang === 'es'
            ? 'Bioingeniería declarada en etiqueta'
            : 'Bioengineered food declared on label',
        note:
          lang === 'es'
            ? 'Declaración oficial en empaque (normativa EE.UU. u equivalente).'
            : 'Official on-pack disclosure (US Bioengineered Food Standard or equivalent).',
      });
      break;
    }
  }

  for (const tag of IMITATION_LABEL_TAGS) {
    if (labels.includes(tag) || categories.includes(tag) || categories.some((c) => c.includes(tag.replace('en:', '')))) {
      findings.push({
        id: 'imitation_category',
        severity: SEVERITY.HIGH,
        label:
          lang === 'es'
            ? 'Producto de imitación / alternativa vegetal (categoría)'
            : 'Imitation / plant-based alternative (category)',
        note:
          lang === 'es'
            ? 'Clasificado como análogo o alternativa a carne/lácteos — no es el alimento original.'
            : 'Classified as a meat/dairy analogue or alternative — not the original food.',
      });
      break;
    }
  }

  for (const marker of findMatches(nameBlob, BIOENGINEERED_MARKERS)) {
    findings.push({
      id: marker.id,
      severity: marker.severity,
      label: label(marker),
      note: typeof marker.note === 'object' ? marker.note[lang] || marker.note.en : marker.note,
    });
  }

  const hasNonGmoLabel = NON_GMO_LABELS.some((tag) => labels.some((l) => l.includes(tag.replace('en:', ''))));
  const seen = new Set();
  return {
    findings: findings.filter((f) => {
      const key = f.id + f.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    hasNonGmoLabel,
  };
}

/**
 * Tier ultraprocessed products:
 * - classic: seed oils, artificial sweeteners, HFCS, synthetic dyes/flavors
 * - clean_label: NOVA 4 but real food + good fats, without classic red flags
 * - standard: other NOVA 4
 */
export function classifyUpfTier(product, ingredientsText) {
  const text = ingredientsText || '';
  const novaGroup = detectNovaGroup(product, text);
  if (novaGroup !== 4) return { tier: null, wholeFoodSignals: [], classicRedFlags: [] };

  const seedOils = findMatches(text, SEED_OILS);
  const flaggedSweeteners = findMatches(text, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length));
  const artificialHigh = findMatches(text, ARTIFICIAL_MARKERS.filter((m) => m.severity === SEVERITY.HIGH));
  const nova4Markers = findMatches(text, NOVA4_MARKERS);
  const concerningAdditives = findAdditiveMatches(text, product.additives_tags).filter(
    (a) => a.severity === SEVERITY.HIGH
  );

  const classicRedFlags = [];
  if (seedOils.length) classicRedFlags.push('seed_oils');
  if (flaggedSweeteners.length) classicRedFlags.push('artificial_sweeteners');
  if (artificialHigh.length) classicRedFlags.push('artificial_ingredients');
  if (nova4Markers.some((m) => m.id === 'hfcs')) classicRedFlags.push('hfcs');
  if (nova4Markers.some((m) => m.id === 'hydrogenated_oil')) classicRedFlags.push('hydrogenated');
  if (concerningAdditives.some((a) => a.id === 'e102')) classicRedFlags.push('synthetic_dyes');

  if (classicRedFlags.length > 0) {
    return { tier: 'classic', wholeFoodSignals: [], classicRedFlags };
  }

  const wholeFoodSignals = WHOLE_FOOD_SIGNALS.filter((s) => matchPatterns(text, s.patterns));

  if (seedOils.length === 0 && wholeFoodSignals.length >= 1) {
    return { tier: 'clean_label', wholeFoodSignals, classicRedFlags: [] };
  }

  return { tier: 'standard', wholeFoodSignals, classicRedFlags: [] };
}

export function upfTierLabel(tier, lang = 'es') {
  if (tier === 'classic') {
    return lang === 'es' ? 'perfil clásico (chatarra)' : 'classic junk-food profile';
  }
  if (tier === 'clean_label') {
    return lang === 'es' ? 'etiqueta limpia' : 'clean label';
  }
  return '';
}

export function assessCleanProfile(product, ingredientsText) {
  const text = ingredientsText || '';
  const seedOils = findMatches(text, SEED_OILS);
  const flaggedSweeteners = findMatches(text, FLAGGED_SWEETENERS.filter((s) => s.patterns?.length));
  const artificialHigh = findMatches(text, ARTIFICIAL_MARKERS.filter((m) => m.severity === SEVERITY.HIGH));
  const wholeFoodSignals = WHOLE_FOOD_SIGNALS.filter((s) => matchPatterns(text, s.patterns));
  const isClean =
    seedOils.length === 0 &&
    flaggedSweeteners.length === 0 &&
    artificialHigh.length === 0 &&
    wholeFoodSignals.length >= 1;
  return { isClean, wholeFoodSignals };
}
