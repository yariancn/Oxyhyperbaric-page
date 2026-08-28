export const STRINGS = {
  es: {
    appName: 'VerdiScan',
    tagline: 'Escanea. Comprende. Elige mejor.',
    scanBtn: 'Escanear código',
    manualBtn: 'Ingresar código manualmente',
    history: 'Historial',
    placeholder: 'Ej: 7501000650320',
    search: 'Buscar producto',
    scanning: 'Apunta al código de barras…',
    loading: 'Consultando base de datos…',
    notFound: 'Producto no encontrado en Open Food Facts.',
    notFoundHint: 'Prueba otro código o contribuye escaneando en openfoodfacts.org',
    errorNetwork: 'Error de conexión. Verifica tu internet.',
    scoreLabel: 'Puntuación Verdi',
    novaLabel: 'Clasificación NOVA',
    alertsTitle: 'Alertas detectadas',
    positivesTitle: 'Aspectos positivos',
    ingredientsTitle: 'Ingredientes',
    noIngredients: 'Ingredientes no disponibles en la base de datos.',
    marketNote: 'Datos de Open Food Facts — cobertura variable en MX/US.',
    disclaimerTitle: 'Aviso informativo',
    disclaimer:
      'VerdiScan es una herramienta informativa basada en datos públicos y criterios de salud de la literatura científica reciente. No constituye consejo médico, nutricional ni legal. Consulta a un profesional de salud para decisiones dietéticas personalizadas. Los resultados pueden contener errores en la base de datos.',
    nova1: 'Sin procesar / mínimo procesado',
    nova2: 'Ingrediente culinario',
    nova3: 'Procesado',
    nova4: 'Ultraprocesado',
    novaUnknown: 'No clasificado',
    scanAgain: 'Escanear otro',
    stopScan: 'Detener cámara',
    emptyHistory: 'Aún no has escaneado productos.',
    clearHistory: 'Limpiar historial',
    langToggle: 'EN',
    sources: 'Fuentes: NOVA (Monteiro), NutriNet-Santé, OMS, Open Food Facts',
  },
  en: {
    appName: 'VerdiScan',
    tagline: 'Scan. Understand. Choose better.',
    scanBtn: 'Scan barcode',
    manualBtn: 'Enter barcode manually',
    history: 'History',
    placeholder: 'e.g. 012000161032',
    search: 'Look up product',
    scanning: 'Point at the barcode…',
    loading: 'Querying database…',
    notFound: 'Product not found in Open Food Facts.',
    notFoundHint: 'Try another code or contribute at openfoodfacts.org',
    errorNetwork: 'Connection error. Check your internet.',
    scoreLabel: 'Verdi Score',
    novaLabel: 'NOVA Classification',
    alertsTitle: 'Alerts detected',
    positivesTitle: 'Positive aspects',
    ingredientsTitle: 'Ingredients',
    noIngredients: 'Ingredients not available in the database.',
    marketNote: 'Data from Open Food Facts — variable coverage in MX/US.',
    disclaimerTitle: 'Informational notice',
    disclaimer:
      'VerdiScan is an informational tool based on public data and health criteria from recent scientific literature. It does not constitute medical, nutritional, or legal advice. Consult a healthcare professional for personalized dietary decisions. Database results may contain errors.',
    nova1: 'Unprocessed / minimally processed',
    nova2: 'Culinary ingredient',
    nova3: 'Processed',
    nova4: 'Ultra-processed',
    novaUnknown: 'Not classified',
    scanAgain: 'Scan another',
    stopScan: 'Stop camera',
    emptyHistory: 'No products scanned yet.',
    clearHistory: 'Clear history',
    langToggle: 'ES',
    sources: 'Sources: NOVA (Monteiro), NutriNet-Santé, WHO, Open Food Facts',
  },
};

export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export function novaLabel(lang, group) {
  if (group === 1) return t(lang, 'nova1');
  if (group === 2) return t(lang, 'nova2');
  if (group === 3) return t(lang, 'nova3');
  if (group === 4) return t(lang, 'nova4');
  return t(lang, 'novaUnknown');
}
