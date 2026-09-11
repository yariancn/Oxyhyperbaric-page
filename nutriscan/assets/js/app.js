import { fetchProduct } from './off-api.js';
import { analyzeProduct } from './scoring.js';
import { startScanner, stopScanner, isCameraSupported } from './scanner.js';
import { ocrIngredientsImage, isIncompleteIngredientList, countIngredientItems } from './ocr.js';
import { t, novaLabel } from './i18n.js';
import {
  initSession,
  register,
  login,
  logout,
  getUser,
  authHeaders,
  startCheckout,
  updateUserFromAccount,
  canScanLocally,
  refreshMe,
} from './session.js';
import { initInstallGuide } from './install.js';
import {
  SCORING_FACTORS,
  WEIGHT_LEVELS,
  loadWeights,
  saveWeights,
  defaultWeights,
  levelLabelKey,
} from './weights.js';

const HISTORY_KEY = 'verdiscan_history';
const LANG_KEY = 'verdiscan_lang';

let lang = localStorage.getItem(LANG_KEY) || (navigator.language?.startsWith('es') ? 'es' : 'en');
let scanning = false;
let pendingBarcode = '';
let pendingProduct = null;
let authMode = 'login';
let criteriaWeights = loadWeights();

const $ = (sel) => document.querySelector(sel);
const authHdr = (extra = {}) => authHeaders(extra);

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
  $('#breakdown-title').textContent = t(lang, 'breakdownTitle');
  $('#breakdown-intro').textContent = t(lang, 'breakdownIntro');
  $('#lang-toggle').textContent = t(lang, 'langToggle');
  $('#clear-history').textContent = t(lang, 'clearHistory');
  $('#ingredients-entry-title').textContent = t(lang, 'ingredientsEntryTitle');
  $('#ingredients-input').placeholder = t(lang, 'ingredientsPlaceholder');
  $('#manual-product-name').placeholder = t(lang, 'productNamePlaceholder');
  $('#analyze-ingredients-btn').textContent = t(lang, 'analyzeIngredients');
  $('#photo-ingredients-label').textContent = t(lang, 'photoIngredients');
  $('#gallery-ingredients-label').textContent = t(lang, 'galleryIngredients');
  const reviewLabel = $('#ingredients-review-label');
  if (reviewLabel) reviewLabel.textContent = t(lang, 'ingredientsReviewLabel');
  renderHistory();
  renderAccountBar();
  applyAuthText();
  applyInstallText();
  applyPaywallText();
  renderCriteriaPanel();
}

function renderCriteriaPanel() {
  const title = $('#criteria-summary-title');
  const hint = $('#criteria-summary-hint');
  const intro = $('#criteria-intro');
  const resetBtn = $('#criteria-reset-btn');
  const list = $('#criteria-list');
  if (!list) return;

  if (title) title.textContent = t(lang, 'criteriaTitle');
  if (hint) hint.textContent = t(lang, 'criteriaHint');
  if (intro) intro.textContent = t(lang, 'criteriaIntro');
  if (resetBtn) resetBtn.textContent = t(lang, 'criteriaReset');

  list.innerHTML = '';
  for (const factor of SCORING_FACTORS) {
    const value = criteriaWeights[factor.id] ?? factor.default;
    const row = document.createElement('div');
    row.className = `criteria-row${factor.kind === 'bonus' ? ' criteria-row-bonus' : ''}`;
    row.dataset.factorId = factor.id;

    const label = factor.label[lang] || factor.label.en;
    const factorHint = factor.hint[lang] || factor.hint.en;
    const levelText = t(lang, levelLabelKey(value));
    const kindBadge =
      factor.kind === 'bonus'
        ? `<span class="criteria-kind-badge">${lang === 'es' ? 'Bono +' : 'Bonus +'}</span>`
        : '';

    row.innerHTML = `
      <div class="criteria-row-top">
        <div class="criteria-labels">
          <strong>${label} ${kindBadge}</strong>
          <span class="criteria-factor-hint">${factorHint}</span>
        </div>
        <span class="criteria-level" data-level-for="${factor.id}">${levelText}</span>
      </div>
      <input
        type="range"
        class="criteria-slider"
        min="0"
        max="${WEIGHT_LEVELS.length - 1}"
        step="1"
        value="${WEIGHT_LEVELS.findIndex((l) => l.value === value)}"
        data-factor="${factor.id}"
        aria-label="${label}"
      />
      <div class="criteria-ticks" aria-hidden="true">
        ${WEIGHT_LEVELS.map((lv) => `<span>${t(lang, lv.key)}</span>`).join('')}
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('.criteria-slider').forEach((slider) => {
    slider.addEventListener('input', onCriteriaSlider);
  });
}

function onCriteriaSlider(e) {
  const factorId = e.target.dataset.factor;
  const idx = Number(e.target.value);
  const level = WEIGHT_LEVELS[idx];
  if (!level || !factorId) return;
  criteriaWeights = { ...criteriaWeights, [factorId]: level.value };
  saveWeights(criteriaWeights);
  const badge = document.querySelector(`[data-level-for="${factorId}"]`);
  if (badge) badge.textContent = t(lang, level.key);
}

function initCriteriaPanel() {
  const resetBtn = $('#criteria-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      criteriaWeights = defaultWeights();
      saveWeights(criteriaWeights);
      renderCriteriaPanel();
    });
  }
  renderCriteriaPanel();
}

function applyAuthText() {
  $('#auth-title').textContent = t(lang, 'authTitle');
  $('#auth-subtitle').textContent = t(lang, 'authSubtitle');
  $('#auth-tab-login').textContent = t(lang, 'loginTab');
  $('#auth-tab-register').textContent = t(lang, 'registerTab');
  $('#auth-email-label').textContent = t(lang, 'emailLabel');
  $('#auth-password-label').textContent = t(lang, 'passwordLabel');
  $('#auth-code-label').textContent = t(lang, 'signupCodeLabel');
  $('#auth-submit').textContent = authMode === 'login' ? t(lang, 'loginBtn') : t(lang, 'registerBtn');
  $('#logout-btn').textContent = t(lang, 'logoutBtn');
}

function applyInstallText() {
  const set = (id, key) => {
    const el = $(id);
    if (el) el.textContent = t(lang, key);
  };
  set('#install-title', 'installTitle');
  set('#install-subtitle', 'installSubtitle');
  set('#install-native-btn', 'installNativeBtn');
  set('#install-ios-1', 'installIos1');
  set('#install-ios-2', 'installIos2');
  set('#install-ios-3', 'installIos3');
  set('#install-android-1', 'installAndroid1');
  set('#install-android-2', 'installAndroid2');
  set('#install-dismiss-btn', 'installDismiss');
  const fab = $('#install-fab');
  if (fab) fab.setAttribute('aria-label', t(lang, 'installFab'));
}

function applyPaywallText() {
  $('#paywall-title').textContent = t(lang, 'paywallTitle');
  $('#paywall-body').textContent = t(lang, 'paywallBody');
  $('#paywall-checkout-btn').textContent = t(lang, 'paywallBtn');
  $('#paywall-dismiss-btn').textContent = t(lang, 'paywallLater');
}

function renderAccountBar() {
  const user = getUser();
  const bar = $('#account-bar');
  if (!user) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('#account-email').textContent = user.email;
  const scansEl = $('#account-scans');
  if (user.paid || user.unlimited) {
    scansEl.textContent = t(lang, 'scansUnlimited');
  } else {
    scansEl.textContent = t(lang, 'scansRemaining').replace(
      '{n}',
      String(user.scansRemaining ?? 0)
    );
  }
}

function showAuth(show) {
  $('#auth-view').hidden = !show;
  $('#app-main').hidden = show;
  $('#account-bar').hidden = show || !getUser();
}

function setAuthMode(mode) {
  authMode = mode;
  $('#auth-tab-login').classList.toggle('is-active', mode === 'login');
  $('#auth-tab-register').classList.toggle('is-active', mode === 'register');
  $('#signup-code-wrap').hidden = mode !== 'register';
  $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  applyAuthText();
}

function showPaywall() {
  applyPaywallText();
  $('#paywall-modal').hidden = false;
}

function hidePaywall() {
  $('#paywall-modal').hidden = true;
}

function authErrorMessage(code) {
  const map = {
    INVALID_CODE: 'authErrorInvalidCode',
    EMAIL_EXISTS: 'authErrorEmailExists',
    INVALID_CREDENTIALS: 'authErrorCredentials',
    WEAK_PASSWORD: 'authErrorWeakPassword',
  };
  return t(lang, map[code] || 'authErrorGeneric');
}

function handleScanLimit(err) {
  if (err?.account?.scansUsed != null) {
    updateUserFromAccount({
      ...getUser(),
      scansUsed: err.account.scansUsed,
      scansRemaining: 0,
    });
  }
  renderAccountBar();
  showPaywall();
  refreshMe().then(renderAccountBar);
}

async function enterApp() {
  const token = getToken();
  if (!token) {
    showAuth(true);
    return;
  }

  // Entrar de inmediato con sesión cacheada; validar en segundo plano
  showAuth(false);
  renderAccountBar();
  handleCheckoutReturn();

  try {
    const user = await refreshMe();
    if (!user && !getToken()) {
      showAuth(true);
      return;
    }
    renderAccountBar();
  } catch {
    renderAccountBar();
  }
}

function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    refreshMeAndBar();
    showError(t(lang, 'checkoutSuccess'), '');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('checkout') === 'cancel') {
    showError(t(lang, 'checkoutCancel'), '');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

async function refreshMeAndBar() {
  await refreshMe();
  renderAccountBar();
}

function ensureCanScan() {
  if (!canScanLocally()) {
    showPaywall();
    return false;
  }
  return true;
}

function showView(view) {
  $('#home-view').hidden = view !== 'home';
  $('#result-view').hidden = view !== 'result';
  $('#scanner-panel').hidden = view !== 'scan';
}

function showLoading(show) {
  $('#loading').hidden = !show;
  if (show) $('#loading-text').textContent = t(lang, 'loadingSources');
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

function showIngredientsEntry({ barcode, product, reason }) {
  pendingBarcode = barcode || '';
  pendingProduct = product || null;
  const panel = $('#ingredients-entry');
  panel.hidden = false;
  $('#ingredients-entry-title').textContent = t(lang, 'ingredientsEntryTitle');
  $('#ingredients-entry-hint').textContent =
    reason === 'not_found' ? t(lang, 'notFoundHint') : t(lang, 'needsIngredientsHint');
  const bc = $('#ingredients-entry-barcode');
  if (pendingBarcode) {
    bc.hidden = false;
    bc.textContent = `Código: ${pendingBarcode}`;
  } else {
    bc.hidden = true;
  }
  $('#ingredients-input').value = '';
  $('#manual-product-name').value = product?.product_name || '';
  const previewWrap = $('#ocr-preview-wrap');
  if (previewWrap) {
    previewWrap.hidden = true;
    $('#ocr-preview').removeAttribute('src');
    $('#ocr-status').textContent = '';
    $('#ocr-status').classList.remove('is-error');
  }
}

function hideIngredientsEntry() {
  $('#ingredients-entry').hidden = true;
  pendingBarcode = '';
  pendingProduct = null;
}

function saveHistory(entry) {
  if (entry.score == null) return;
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
  hideIngredientsEntry();

  if (analysis.needsIngredients) {
    showView('home');
    showError(t(lang, 'needsIngredients'), t(lang, 'needsIngredientsHint'));
    showIngredientsEntry({ barcode: product.code, product, reason: 'incomplete' });
    return;
  }

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
  $('#score-value').textContent = analysis.score ?? '—';
  $('#score-grade').textContent = analysis.grade;
  $('#score-summary').textContent = analysis.summary;

  const novaEl = $('#nova-badge');
  if (analysis.novaGroup) {
    novaEl.hidden = false;
    novaEl.className = `nova-badge nova-${analysis.novaGroup}${analysis.upfTier === 'clean_label' || analysis.isCleanProfile ? ' nova-clean' : analysis.upfTier === 'classic' ? ' nova-classic' : ''}`;
    const tierSuffix =
      analysis.upfTier === 'clean_label' || analysis.upfTier === 'classic'
        ? ` · ${analysis.upfTierLabel}`
        : analysis.isProcessedMeat
          ? lang === 'es'
            ? ' · carne procesada'
            : ' · processed meat'
          : '';
    novaEl.textContent = `${t(lang, 'novaLabel')}: ${novaLabel(lang, analysis.novaGroup)}${tierSuffix}`;
  } else {
    novaEl.hidden = true;
  }

  const goodList = $('#good-list');
  const badList = $('#bad-list');
  goodList.innerHTML = '';
  badList.innerHTML = '';
  $('#verdict-section').hidden = false;
  $('#good-title').textContent = t(lang, 'goodTitle');
  $('#bad-title').textContent = t(lang, 'badTitle');

  const goodPoints = analysis.goodPoints || [];
  const badPoints = analysis.badPoints || [];

  if (goodPoints.length) {
    for (const point of goodPoints) {
      const li = document.createElement('li');
      li.textContent = point;
      goodList.appendChild(li);
    }
  } else {
    goodList.innerHTML = `<li class="verdict-empty">${t(lang, 'noGoodPoints')}</li>`;
  }

  if (badPoints.length) {
    for (const point of badPoints) {
      const li = document.createElement('li');
      li.textContent = point;
      badList.appendChild(li);
    }
  } else {
    badList.innerHTML = `<li class="verdict-empty">${t(lang, 'noBadPoints')}</li>`;
  }

  const breakdownList = $('#breakdown-list');
  breakdownList.innerHTML = '';
  const breakdown = analysis.scoreBreakdown || [];
  $('#breakdown-section').hidden = breakdown.length === 0;
  $('#breakdown-title').textContent = t(lang, 'breakdownTitle');
  $('#breakdown-intro').textContent = t(lang, 'breakdownIntro');

  const baseLine = document.createElement('li');
  baseLine.className = 'breakdown-item breakdown-base';
  baseLine.innerHTML = `<div class="breakdown-label"><strong>100</strong><span>${t(lang, 'breakdownBaseNote')}</span></div><div class="breakdown-delta">—</div>`;
  breakdownList.appendChild(baseLine);

  for (const line of breakdown) {
    const li = document.createElement('li');
    const isBonus = line.delta > 0;
    li.className = `breakdown-item ${isBonus ? 'breakdown-plus' : 'breakdown-minus'}`;
    const deltaText = isBonus ? `+${line.delta}` : String(line.delta);
    li.innerHTML = `
      <div class="breakdown-label">
        <strong>${escapeHtml(line.label)}</strong>
        <span>${escapeHtml(line.reason)}</span>
      </div>
      <div class="breakdown-delta">${deltaText}</div>
    `;
    breakdownList.appendChild(li);
  }

  const totalLine = document.createElement('li');
  totalLine.className = 'breakdown-item breakdown-total';
  totalLine.innerHTML = `<span>${lang === 'es' ? 'Total' : 'Total'}</span><strong>${analysis.score}</strong>`;
  breakdownList.appendChild(totalLine);

  $('#rules-version').textContent = analysis.rulesVersion
    ? `${lang === 'es' ? 'Motor de reglas' : 'Rules engine'} v${analysis.rulesVersion}`
    : '';

  const ultraList = $('#ultra-list');
  ultraList.innerHTML = '';
  $('#ultra-section').hidden = !analysis.ultraProcessedItems?.length;
  $('#ultra-title').textContent = t(lang, 'ultraTitle');

  for (const item of analysis.ultraProcessedItems || []) {
    const li = document.createElement('li');
    li.className = 'chip-item';
    li.textContent = item.label;
    ultraList.appendChild(li);
  }

  const bioList = $('#bio-list');
  bioList.innerHTML = '';
  $('#bio-section').hidden = !analysis.bioengineeredItems?.length;
  $('#bio-title').textContent = t(lang, 'bioTitle');

  for (const item of analysis.bioengineeredItems || []) {
    const li = document.createElement('li');
    li.className = `alert-item severity-${item.severity}`;
    li.innerHTML = `
      <span class="alert-icon">${severityIcon(item.severity)}</span>
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      </div>
    `;
    bioList.appendChild(li);
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

function analyzeManualIngredients() {
  const text = $('#ingredients-input').value.trim();
  if (text.length < 3) {
    showError(
      lang === 'es'
        ? 'Fotografía el bloque de ingredientes (no solo el frente) o completa el texto'
        : 'Photograph the ingredients panel (not just the front) or complete the text'
    );
    return;
  }

  if (isIncompleteIngredientList(text)) {
    const n = countIngredientItems(text);
    showError(
      t(lang, 'ocrIncompleteTitle'),
      t(lang, 'ocrIncompleteHint').replace('{n}', String(n))
    );
    return;
  }

  const name =
    $('#manual-product-name').value.trim() ||
    pendingProduct?.product_name ||
    (lang === 'es' ? 'Producto manual' : 'Manual product');

  const product = {
    ...(pendingProduct || {}),
    code: pendingBarcode || pendingProduct?.code || 'manual',
    product_name: name,
    brands: pendingProduct?.brands || '',
    ingredients_text: text,
    ingredients_text_es: text,
    ingredients_text_en: text,
    labels_tags: pendingProduct?.labels_tags || [],
    categories_tags: pendingProduct?.categories_tags || [],
    additives_n: pendingProduct?.additives_n,
    additives_tags: pendingProduct?.additives_tags,
    nutriments: pendingProduct?.nutriments || {},
    image_front_url: pendingProduct?.image_front_url,
    image_url: pendingProduct?.image_url,
    _verdiscan_from_ocr: true,
  };

  const analysis = analyzeProduct(product, lang, criteriaWeights);
  renderResult(product, analysis);
}

async function processIngredientsPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;

  hideError();
  const previewWrap = $('#ocr-preview-wrap');
  const preview = $('#ocr-preview');
  const status = $('#ocr-status');
  const analyzeBtn = $('#analyze-ingredients-btn');
  const photoBtn = $('#photo-ingredients-btn');
  const galleryBtn = $('#gallery-ingredients-btn');

  previewWrap.hidden = false;
  preview.src = URL.createObjectURL(file);
  status.classList.remove('is-error');
  status.textContent = t(lang, 'ocrLoading');
  analyzeBtn.disabled = true;
  photoBtn.disabled = true;
  galleryBtn.disabled = true;

  const nameHint =
    $('#manual-product-name').value.trim() ||
    pendingProduct?.product_name ||
    '';

  try {
    const result = await ocrIngredientsImage(file, (pct) => {
      status.textContent = `${t(lang, 'ocrLoading')} ${pct}%`;
    }, nameHint, authHdr);

    if (result.account) {
      updateUserFromAccount(result.account);
      renderAccountBar();
    }

    if (result.name && !$('#manual-product-name').value.trim()) {
      $('#manual-product-name').value = result.name;
    }
    if (result.brand && pendingProduct && !pendingProduct.brands) {
      pendingProduct.brands = result.brand;
    }

    // Found full ingredients in a database via product name
    if (result.fromDatabase && result.product && result.ingredients) {
      $('#ingredients-input').value = result.ingredients;
      status.textContent = t(lang, 'ocrFromDb');
      pendingProduct = { ...(pendingProduct || {}), ...result.product };
      analyzeBtn.disabled = false;
      photoBtn.disabled = false;
      galleryBtn.disabled = false;
      return;
    }

    if (!result.ingredients || result.ingredients.length < 3 || result.empty) {
      status.classList.add('is-error');
      status.textContent = t(lang, 'ocrEmpty');
      return;
    }

    $('#ingredients-input').value = result.ingredients;

    if (result.incomplete || result.frontOnly) {
      status.classList.add('is-error');
      status.textContent = t(lang, 'ocrIncompleteHint').replace(
        '{n}',
        String(result.itemCount || countIngredientItems(result.ingredients))
      );
      showError(t(lang, 'ocrIncompleteTitle'), t(lang, 'ocrIncompleteHint').replace('{n}', String(result.itemCount || 0)));
      return;
    }

    status.textContent = t(lang, 'ocrDone');
    $('#ingredients-input').focus();
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      // Revalidar: si el token sigue vivo, no echar al login
      const still = await refreshMe();
      if (!still) showAuth(true);
      else showError(t(lang, 'errorNetwork'));
      return;
    }
    if (err.message === 'SCAN_LIMIT') {
      handleScanLimit(err);
      return;
    }
    status.classList.add('is-error');
    status.textContent = t(lang, 'ocrError');
  } finally {
    analyzeBtn.disabled = false;
    photoBtn.disabled = false;
    galleryBtn.disabled = false;
  }
}

function onPhotoInputChange(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) processIngredientsPhoto(file);
}

async function lookupBarcode(barcode) {
  if (!ensureCanScan()) return;
  hideError();
  hideIngredientsEntry();
  showLoading(true);
  await stopScannerActive();

  try {
    const product = await fetchProduct(barcode, authHdr);
    if (product?._verdiscan_account) {
      updateUserFromAccount(product._verdiscan_account);
      renderAccountBar();
    }
    const analysis = analyzeProduct(product, lang, criteriaWeights);
    if (analysis.needsIngredients) {
      showView('home');
      showError(t(lang, 'needsIngredients'), t(lang, 'needsIngredientsHint'));
      showIngredientsEntry({ barcode: product.code, product, reason: 'incomplete' });
      return;
    }
    renderResult(product, analysis);
  } catch (err) {
    showView('home');
    if (err.message === 'UNAUTHORIZED') {
      const still = await refreshMe();
      if (!still) showAuth(true);
      else showError(t(lang, 'errorNetwork'));
    } else if (err.message === 'SCAN_LIMIT') {
      handleScanLimit(err);
    } else if (err.message === 'NOT_FOUND') {
      showError(t(lang, 'notFound'), t(lang, 'notFoundHint'));
      showIngredientsEntry({ barcode, product: null, reason: 'not_found' });
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
  if (!ensureCanScan()) return;
  hideError();
  hideIngredientsEntry();

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
  } catch (err) {
    scanning = false;
    showView('home');
    let detail;
    if (err?.message === 'SCANNER_LIB_MISSING') {
      detail =
        lang === 'es'
          ? 'Recarga la página e inténtalo de nuevo.'
          : 'Reload the page and try again.';
    } else if (/Mac|Win|Linux/i.test(navigator.platform || '') || !/Mobile/i.test(navigator.userAgent)) {
      detail =
        lang === 'es'
          ? 'En Mac: permite la cámara cuando el navegador lo pida. Si la bloqueaste: Ajustes del sistema → Privacidad y seguridad → Cámara → activa Chrome/Safari. También puedes ingresar el código manualmente.'
          : 'On Mac: allow the camera when prompted. If blocked: System Settings → Privacy & Security → Camera → enable Chrome/Safari. Or enter the barcode manually.';
    } else {
      detail =
        lang === 'es'
          ? 'Si denegaste el permiso, ve a Ajustes → Safari → Cámara (o Ajustes → VerdiScan) y actívala.'
          : 'If you denied permission, enable Camera in Settings → Safari (or the app).';
    }
    showError(
      lang === 'es' ? 'No se pudo acceder a la cámara' : 'Could not access camera',
      detail
    );
    $('#manual-panel').hidden = false;
  }
}

function initAuthUi() {
  setAuthMode('login');

  $('#auth-tab-login').addEventListener('click', () => setAuthMode('login'));
  $('#auth-tab-register').addEventListener('click', () => setAuthMode('register'));

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const signupCode = $('#auth-signup-code').value.trim();
    const errEl = $('#auth-error');
    errEl.hidden = true;

    const result =
      authMode === 'login'
        ? await login(email, password)
        : await register(email, password, signupCode);

    if (result.error) {
      errEl.textContent = authErrorMessage(result.error);
      errEl.hidden = false;
      return;
    }

    $('#auth-form').reset();
    showAuth(false);
    renderAccountBar();
    hideError();
  });

  $('#logout-btn').addEventListener('click', async () => {
    await logout();
    showAuth(true);
    renderAccountBar();
  });

  $('#paywall-checkout-btn').addEventListener('click', async () => {
    $('#paywall-checkout-btn').disabled = true;
    const result = await startCheckout();
    if (result.error) {
      showError(t(lang, 'authErrorGeneric'));
      $('#paywall-checkout-btn').disabled = false;
    }
  });

  $('#paywall-dismiss-btn').addEventListener('click', hidePaywall);
}

async function init() {
  applyStaticText();
  initAuthUi();
  initCriteriaPanel();
  initInstallGuide(lang, t);
  await enterApp();

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

  $('#analyze-ingredients-btn').addEventListener('click', analyzeManualIngredients);

  $('#photo-ingredients-btn').addEventListener('click', () => {
    $('#ingredients-camera-input').click();
  });
  $('#gallery-ingredients-btn').addEventListener('click', () => {
    $('#ingredients-gallery-input').click();
  });
  $('#ingredients-camera-input').addEventListener('change', onPhotoInputChange);
  $('#ingredients-gallery-input').addEventListener('change', onPhotoInputChange);

  $('#scan-again-btn').addEventListener('click', () => {
    showView('home');
    hideError();
    hideIngredientsEntry();
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
