import { fetchProduct } from './off-api.js';
import { analyzeProduct } from './scoring.js';
import { startScanner, stopScanner, isCameraSupported } from './scanner.js';
import { t, novaLabel } from './i18n.js';

const HISTORY_KEY = 'verdiscan_history';
const LANG_KEY = 'verdiscan_lang';

let lang = localStorage.getItem(LANG_KEY) || (navigator.language?.startsWith('es') ? 'es' : 'en');
let scanning = false;

const $ = (sel) => document.querySelector(sel);

function setLang(newLang) {
  lang = newLang;
  localStorage.setItem(LANG_KEY, newLang);
  applyStaticText();
}

function applyStaticText() {
  document.documentElement.lang = lang;
  $('#app-name').textContent = t(lang, 'appName');
  $('#tagline').textContent = t(lang, 'tagline');
  $('#scan-btn-label').textContent = t(lang, 'scanBtn');
  $('#manual-toggle-label').textContent = t(lang, 'manualBtn');
  $('#history-title').textContent = t(lang, 'history');
  $('#barcode-input').placeholder = t(lang, 'placeholder');
  $('#search-btn').textContent = t(lang, 'search');
  $('#disclaimer-title').textContent = t(lang, 'disclaimerTitle');
  $('#disclaimer-text').textContent = t(lang, 'disclaimer');
  $('#sources-text').textContent = t(lang, 'sources');
  $('#lang-toggle').textContent = t(lang, 'langToggle');
  $('#clear-history').textContent = t(lang, 'clearHistory');
  renderHistory();
}

function showView(view) {
  $('#home-view').hidden = view !== 'home';
  $('#result-view').hidden = view !== 'result';
  $('#scanner-panel').hidden = view !== 'scan';
}

function showLoading(show) {
  $('#loading').hidden = !show;
  if (show) $('#loading-text').textContent = t(lang, 'loading');
}

function showError(message, hint) {
  const el = $('#error-banner');
  el.hidden = false;
  el.querySelector('.error-msg').textContent = message;
  el.querySelector('.error-hint').textContent = hint || '';
}

function hideError() {
  $('#error-banner').hidden = true;
}

function saveHistory(entry) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const filtered = history.filter((h) => h.barcode !== entry.barcode);
  filtered.unshift({ ...entry, scannedAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 50)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const list = $('#history-list');
  list.innerHTML = '';

  if (!history.length) {
    list.innerHTML = `<li class="history-empty">${t(lang, 'emptyHistory')}</li>`;
    return;
  }

  for (const item of history) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <div class="history-score score-${item.gradeColor}">${item.score}</div>
      <div class="history-info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.barcode}</span>
      </div>
    `;
    li.addEventListener('click', () => lookupBarcode(item.barcode));
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function severityIcon(severity) {
  const map = { critical: '⛔', high: '⚠️', moderate: '🔶', low: 'ℹ️', info: '✅' };
  return map[severity] || '•';
}

function renderResult(product, analysis) {
  showView('result');
  hideError();

  const name = product.product_name || '—';
  const img = product.image_front_url || product.image_url;

  $('#product-name').textContent = name;
  $('#product-brand').textContent = product.brands || '';
  $('#product-barcode').textContent = product.code;

  const imgEl = $('#product-image');
  if (img) {
    imgEl.src = img;
    imgEl.hidden = false;
  } else {
    imgEl.hidden = true;
  }

  const scoreRing = $('#score-ring');
  scoreRing.className = `score-ring score-${analysis.gradeColor}`;
  $('#score-value').textContent = analysis.score;
  $('#score-grade').textContent = analysis.grade;
  $('#score-summary').textContent = analysis.summary;

  const novaEl = $('#nova-badge');
  if (analysis.novaGroup) {
    novaEl.hidden = false;
    novaEl.className = `nova-badge nova-${analysis.novaGroup}`;
    novaEl.textContent = `${t(lang, 'novaLabel')}: ${novaLabel(lang, analysis.novaGroup)}`;
  } else {
    novaEl.hidden = true;
  }

  const alertsList = $('#alerts-list');
  alertsList.innerHTML = '';
  $('#alerts-section').hidden = analysis.alerts.length === 0;
  $('#alerts-title').textContent = t(lang, 'alertsTitle');

  for (const alert of analysis.alerts) {
    const li = document.createElement('li');
    li.className = `alert-item severity-${alert.severity}`;
    li.innerHTML = `
      <span class="alert-icon">${severityIcon(alert.severity)}</span>
      <div>
        <strong>${escapeHtml(alert.label)}</strong>
        ${alert.note ? `<p>${escapeHtml(alert.note)}</p>` : ''}
      </div>
    `;
    alertsList.appendChild(li);
  }

  const posList = $('#positives-list');
  posList.innerHTML = '';
  $('#positives-section').hidden = analysis.positives.length === 0;
  $('#positives-title').textContent = t(lang, 'positivesTitle');

  for (const p of analysis.positives) {
    const li = document.createElement('li');
    li.className = 'positive-item';
    li.innerHTML = `<span>✅</span><div><strong>${escapeHtml(p.label)}</strong>${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}</div>`;
    posList.appendChild(li);
  }

  const ing =
    product.ingredients_text_es ||
    product.ingredients_text_en ||
    product.ingredients_text;
  $('#ingredients-title').textContent = t(lang, 'ingredientsTitle');
  $('#ingredients-text').textContent = ing || t(lang, 'noIngredients');

  $('#market-note').textContent = t(lang, 'marketNote');
  $('#scan-again-btn').textContent = t(lang, 'scanAgain');

  saveHistory({
    barcode: product.code,
    name,
    score: analysis.score,
    gradeColor: analysis.gradeColor,
  });
  renderHistory();
}

async function lookupBarcode(barcode) {
  hideError();
  showLoading(true);
  await stopScannerActive();

  try {
    const product = await fetchProduct(barcode);
    const analysis = analyzeProduct(product, lang);
    renderResult(product, analysis);
  } catch (err) {
    showView('home');
    if (err.message === 'NOT_FOUND') {
      showError(t(lang, 'notFound'), t(lang, 'notFoundHint'));
    } else if (err.message === 'INVALID_BARCODE') {
      showError(lang === 'es' ? 'Código inválido' : 'Invalid barcode');
    } else {
      showError(t(lang, 'errorNetwork'));
    }
  } finally {
    showLoading(false);
  }
}

async function stopScannerActive() {
  if (scanning) {
    await stopScanner();
    scanning = false;
    showView('home');
  }
}

async function toggleScanner() {
  hideError();

  if (scanning) {
    await stopScannerActive();
    return;
  }

  if (!isCameraSupported()) {
    showError(lang === 'es' ? 'Cámara no disponible' : 'Camera not available');
    $('#manual-panel').hidden = false;
    return;
  }

  showView('scan');
  scanning = true;
  $('#scanner-status').textContent = t(lang, 'scanning');
  $('#stop-scan-btn').textContent = t(lang, 'stopScan');

  try {
    await startScanner('scanner-viewport', (barcode) => {
      stopScannerActive().then(() => lookupBarcode(barcode));
    });
  } catch (_) {
    scanning = false;
    showView('home');
    showError(lang === 'es' ? 'No se pudo acceder a la cámara' : 'Could not access camera');
    $('#manual-panel').hidden = false;
  }
}

function init() {
  applyStaticText();

  $('#lang-toggle').addEventListener('click', () => {
    setLang(lang === 'es' ? 'en' : 'es');
  });

  $('#scan-btn').addEventListener('click', toggleScanner);
  $('#stop-scan-btn').addEventListener('click', stopScannerActive);

  $('#manual-toggle').addEventListener('click', () => {
    $('#manual-panel').hidden = !$('#manual-panel').hidden;
  });

  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#barcode-input').value.trim();
    if (code) lookupBarcode(code);
  });

  $('#scan-again-btn').addEventListener('click', () => {
    showView('home');
    hideError();
  });

  $('#clear-history').addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
