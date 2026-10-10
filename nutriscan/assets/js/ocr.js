/**
 * Photograph → OCR for ingredient lists.
 * Primary: Cloudflare Workers AI (/api/ocr).
 * Fallback: client Tesseract.js if API unavailable.
 */

let tesseractPromise = null;

/** Downscale for faster upload + OCR */
export function resizeImageFile(file, maxEdge = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('RESIZE_FAILED'))),
        'image/jpeg',
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function countIngredientItems(text) {
  if (!text) return 0;
  return text
    .split(/[,;•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2).length;
}

export function cleanIngredientsOcr(raw) {
  if (!raw) return '';
  let text = String(raw)
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I');

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const kept = [];
  for (const line of lines) {
    if (/^(nutrition|información\s+nutricional|valor\s+energ|calories|calorías)/i.test(line)) {
      break;
    }
    if (/^(NAME|NOMBRE|BRAND|MARCA)\s*:/i.test(line)) continue;
    if (/^\d+\s*(kcal|kj|g|mg|%)\s*$/i.test(line)) continue;
    kept.push(line);
  }
  text = kept.join(' ');

  return text
    .replace(/ingredientes?\s*[:.\-–]?\s*/gi, '')
    .replace(/ingredients?\s*[:.\-–]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .trim();
}

/** Heuristic: short lists from front-of-pack flavor words are incomplete */
export function isIncompleteIngredientList(text) {
  const cleaned = cleanIngredientsOcr(text);
  const n = countIngredientItems(cleaned);
  return n < 5 || cleaned.length < 40;
}

async function ocrViaServer(file, onProgress, nameHint = '', authHeadersFn) {
  if (onProgress) onProgress(10);
  const resized = await resizeImageFile(file);
  if (onProgress) onProgress(30);
  const dataUrl = await blobToDataUrl(resized);
  if (onProgress) onProgress(45);

  const headers = authHeadersFn
    ? authHeadersFn({ 'content-type': 'application/json' })
    : { 'content-type': 'application/json' };

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: dataUrl, nameHint: nameHint || undefined }),
  });

  if (onProgress) onProgress(90);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (res.status === 402) {
    const err = new Error('SCAN_LIMIT');
    err.account = await res.json().catch(() => ({}));
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `OCR_HTTP_${res.status}`);
  }

  const data = await res.json();
  if (onProgress) onProgress(100);

  const ingredients = cleanIngredientsOcr(data.ingredients || '');
  const incomplete =
    Boolean(data.incomplete) ||
    Boolean(data.frontOnly) ||
    Boolean(data.empty) ||
    (!data.fromDatabase && isIncompleteIngredientList(ingredients));

  return {
    ingredients,
    name: data.name || '',
    brand: data.brand || '',
    empty: Boolean(data.empty) || !ingredients,
    incomplete,
    frontOnly: Boolean(data.frontOnly),
    fromDatabase: Boolean(data.fromDatabase),
    itemCount: data.itemCount || countIngredientItems(ingredients),
    product: data.product || null,
    account: data.account || null,
  };
}

async function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = (async () => {
      const { createWorker } = await import(
        'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js'
      );
      return createWorker(['spa', 'eng'], 1, {
        workerPath:
          'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
        corePath:
          'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
      });
    })().catch((err) => {
      tesseractPromise = null;
      throw err;
    });
  }
  return tesseractPromise;
}

async function ocrViaTesseract(file, onProgress) {
  const resized = await resizeImageFile(file, 1400);
  const worker = await getTesseract();
  const result = await worker.recognize(resized, {}, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const ingredients = cleanIngredientsOcr(result?.data?.text || '');
  return {
    ingredients,
    name: '',
    brand: '',
    empty: !ingredients,
    incomplete: isIncompleteIngredientList(ingredients),
    frontOnly: false,
    fromDatabase: false,
    itemCount: countIngredientItems(ingredients),
    product: null,
  };
}

/**
 * @param {File|Blob} file
 * @param {(pct: number) => void} [onProgress]
 * @param {string} [nameHint]
 */
export async function ocrIngredientsImage(file, onProgress, nameHint = '', authHeadersFn) {
  try {
    return await ocrViaServer(file, onProgress, nameHint, authHeadersFn);
  } catch (serverErr) {
    console.warn('Server OCR failed, trying Tesseract', serverErr);
    try {
      return await ocrViaTesseract(file, onProgress);
    } catch (localErr) {
      console.warn('Tesseract OCR failed', localErr);
      throw serverErr;
    }
  }
}
