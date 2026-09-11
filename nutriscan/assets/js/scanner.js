/**
 * Fast barcode capture for VerdiScan — iOS + desktop Mac friendly.
 * Acquires the camera ASAP (user-gesture safe) and prefers close-up rear lenses on phones.
 */

let activeMode = null; // 'native' | 'html5'
let html5Instance = null;
let nativeStream = null;
let nativeRaf = null;
let nativeVideo = null;
let detectedLock = false;
let onDetectedCallback = null;

const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function supportsNativeBarcode() {
  try {
    return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
  } catch {
    return false;
  }
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isDesktop() {
  if (isIOS()) return false;
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return false;
  return !/Mobile/i.test(navigator.userAgent);
}

function nativeFormatsSync() {
  try {
    if (typeof BarcodeDetector.getSupportedFormats === 'function') {
      const supported = BarcodeDetector.getSupportedFormats();
      if (Array.isArray(supported)) {
        const list = WANTED_FORMATS.filter((f) => supported.includes(f));
        return list.length ? list : WANTED_FORMATS;
      }
    }
  } catch (_) {
    /* ignore */
  }
  return WANTED_FORMATS;
}

function emitBarcode(raw) {
  if (detectedLock || !onDetectedCallback) return;
  const barcode = String(raw).replace(/\D/g, '');
  if (barcode.length < 8) return;
  detectedLock = true;
  try {
    if (navigator.vibrate) navigator.vibrate(40);
  } catch (_) {
    /* ignore */
  }
  onDetectedCallback(barcode);
}

async function releaseNativeCamera() {
  if (nativeRaf) {
    cancelAnimationFrame(nativeRaf);
    nativeRaf = null;
  }
  if (nativeVideo) {
    try {
      nativeVideo.pause();
      nativeVideo.removeAttribute('src');
      nativeVideo.srcObject = null;
    } catch (_) {
      /* ignore */
    }
    nativeVideo = null;
  }
  if (nativeStream) {
    for (const track of nativeStream.getTracks()) {
      try {
        track.stop();
      } catch (_) {
        /* ignore */
      }
    }
    nativeStream = null;
  }
}

function scoreCameraForCloseUp(device) {
  const label = `${device.label || ''}`.toLowerCase();
  let score = 0;
  if (/back|rear|environment|trasera|posterior|world/i.test(label)) score += 40;
  if (/front|user|selfie|frontal|face/i.test(label)) score -= 50;
  if (/macro/i.test(label)) score += 50;
  if (/ultra[\s-]?wide|ultrawide|0\.5|uw\b/i.test(label)) score += 35;
  if (/wide|principal|main|camera 0|camera2 0/i.test(label)) score += 20;
  if (/tele|telephoto|periscope|zoom|3x|5x|10x/i.test(label)) score -= 40;
  if (/dual|triple|quad/i.test(label) && !/front|selfie/i.test(label)) score += 10;
  return score;
}

function sortDevicesForCloseUp(devices) {
  return [...devices].sort((a, b) => scoreCameraForCloseUp(b) - scoreCameraForCloseUp(a));
}

async function applyCloseUpFocus(stream) {
  const track = stream?.getVideoTracks?.()?.[0];
  if (!track?.getCapabilities) return;
  let caps;
  try {
    caps = track.getCapabilities() || {};
  } catch {
    return;
  }

  const basic = {};
  if (caps.focusMode?.includes?.('continuous')) basic.focusMode = 'continuous';
  else if (caps.focusMode?.includes?.('single-shot')) basic.focusMode = 'single-shot';

  if (caps.focusDistance && typeof caps.focusDistance.min === 'number') {
    const min = caps.focusDistance.min;
    const max = caps.focusDistance.max ?? min + 1;
    basic.focusDistance = Math.min(max, Math.max(min, 0.15));
  }

  if (caps.zoom && typeof caps.zoom.min === 'number') {
    const zMin = caps.zoom.min;
    const zMax = caps.zoom.max ?? zMin;
    basic.zoom = Math.min(zMax, Math.max(zMin, zMin + (zMax - zMin) * 0.08));
  }

  if (!Object.keys(basic).length) return;
  try {
    await track.applyConstraints(basic);
  } catch {
    try {
      await track.applyConstraints({ advanced: [basic] });
    } catch {
      /* ignore */
    }
  }
}

/** Immediate camera open — call first in click handler (Safari gesture) */
export async function openCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('CAMERA_UNSUPPORTED');
  }

  const attempts = isDesktop()
    ? [
        { audio: false, video: { facingMode: 'user' } },
        { audio: false, video: true },
      ]
    : [
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        { audio: false, video: { facingMode: 'environment' } },
        { audio: false, video: true },
        { audio: false, video: { facingMode: 'user' } },
      ];

  let lastErr;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await applyCloseUpFocus(stream);
      return stream;
    } catch (err) {
      lastErr = err;
    }
  }

  // Prefer close-up rear lenses when labels are available
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = sortDevicesForCloseUp(
      devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
    );
    for (const cam of cams) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: cam.deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        await applyCloseUpFocus(stream);
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }
  } catch (err) {
    lastErr = err;
  }

  throw lastErr || new Error('CAMERA_DENIED');
}

function stopStreamTracks(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch (_) {
      /* ignore */
    }
  }
}

async function loadHtml5QrcodeLib() {
  if (window.Html5Qrcode) return;
  const urls = [
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  ];
  for (const src of urls) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('SCRIPT_FAIL'));
        document.head.appendChild(s);
      });
      if (window.Html5Qrcode) return;
    } catch {
      /* try next */
    }
  }
  // Wait briefly if page already included a deferred script
  const start = Date.now();
  while (!window.Html5Qrcode && Date.now() - start < 4000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!window.Html5Qrcode) throw new Error('SCANNER_LIB_MISSING');
}

async function startNativeWithStream(container, stream) {
  container.innerHTML = '';
  container.classList.add('scanner-active');

  const wrap = document.createElement('div');
  wrap.className = 'scanner-native-wrap';

  const video = document.createElement('video');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.className = 'scanner-native-video';

  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-guide" aria-hidden="true">
      <span class="scanner-guide-corner tl"></span>
      <span class="scanner-guide-corner tr"></span>
      <span class="scanner-guide-corner bl"></span>
      <span class="scanner-guide-corner br"></span>
      <div class="scanner-laser"></div>
    </div>
  `;

  wrap.appendChild(video);
  wrap.appendChild(overlay);
  container.appendChild(wrap);

  nativeStream = stream;
  nativeVideo = video;
  video.srcObject = stream;

  try {
    await video.play();
  } catch (err) {
    await releaseNativeCamera();
    throw err;
  }

  let formats = nativeFormatsSync();
  if (formats && typeof formats.then === 'function') {
    try {
      const supported = await formats;
      formats = WANTED_FORMATS.filter((f) => supported.includes(f));
      if (!formats.length) formats = WANTED_FORMATS;
    } catch {
      formats = WANTED_FORMATS;
    }
  }

  let detector;
  try {
    detector = new BarcodeDetector({ formats });
  } catch {
    try {
      detector = new BarcodeDetector();
    } catch {
      await releaseNativeCamera();
      throw new Error('BARCODE_DETECTOR_INIT');
    }
  }

  let lastTs = 0;
  const tick = async (ts) => {
    if (!nativeVideo || detectedLock) return;
    nativeRaf = requestAnimationFrame(tick);
    if (ts - lastTs < 100) return;
    lastTs = ts;
    if (video.readyState < 2) return;
    try {
      const codes = await detector.detect(video);
      if (codes?.length && codes[0].rawValue) emitBarcode(codes[0].rawValue);
    } catch (_) {
      /* transient */
    }
  };

  nativeRaf = requestAnimationFrame(tick);
  activeMode = 'native';
}

async function startHtml5Scanner(containerId, container, preStream) {
  await loadHtml5QrcodeLib();

  // html5-qrcode opens its own stream — release ours first
  stopStreamTracks(preStream);

  container.innerHTML = '';
  container.classList.remove('scanner-active');

  html5Instance = new Html5Qrcode(containerId, {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
    ],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });

  const config = {
    fps: isIOS() ? 12 : 20,
    qrbox: (w, h) => ({
      width: Math.floor(Math.min(w * 0.92, isDesktop() ? 480 : 420)),
      height: Math.floor(Math.min(h * (isDesktop() ? 0.42 : 0.3), isDesktop() ? 220 : 140)),
    }),
    disableFlip: false,
    aspectRatio: 1.777,
  };

  const cameraAttempts = isDesktop()
    ? [{ facingMode: 'user' }, { facingMode: 'environment' }]
    : [{ facingMode: 'environment' }, { facingMode: { exact: 'environment' } }, { facingMode: 'user' }];

  let lastErr;
  for (const cameraConfig of cameraAttempts) {
    try {
      await html5Instance.start(cameraConfig, config, (decodedText) => emitBarcode(decodedText), () => {});
      activeMode = 'html5';
      try {
        const videoEl = document.querySelector(`#${containerId} video`);
        if (videoEl?.srcObject) await applyCloseUpFocus(videoEl.srcObject);
      } catch (_) {
        /* ignore */
      }
      return;
    } catch (err) {
      lastErr = err;
      try {
        await html5Instance.stop();
      } catch (_) {
        /* ignore */
      }
    }
  }

  try {
    const cameras = await Html5Qrcode.getCameras();
    const ranked = sortDevicesForCloseUp(
      (cameras || []).map((c) => ({ deviceId: c.id, label: c.label || '', kind: 'videoinput' }))
    );
    for (const cam of ranked) {
      try {
        await html5Instance.start(cam.deviceId, config, (decodedText) => emitBarcode(decodedText), () => {});
        activeMode = 'html5';
        try {
          const videoEl = document.querySelector(`#${containerId} video`);
          if (videoEl?.srcObject) await applyCloseUpFocus(videoEl.srcObject);
        } catch (_) {
          /* ignore */
        }
        return;
      } catch (err) {
        lastErr = err;
        try {
          await html5Instance.stop();
        } catch (_) {
          /* ignore */
        }
      }
    }
  } catch (err) {
    lastErr = err;
  }

  throw lastErr || new Error('CAMERA_DENIED');
}

/**
 * @param {string} containerId
 * @param {(code: string) => void} onDetected
 * @param {MediaStream} [preStream] stream already opened in the click gesture
 */
export async function startScanner(containerId, onDetected, preStream = null) {
  detectedLock = false;

  const container = document.getElementById(containerId);
  if (!container) throw new Error('SCANNER_CONTAINER_MISSING');

  await stopScanner();
  onDetectedCallback = onDetected;
  container.innerHTML = '';

  let stream = preStream;
  if (!stream) {
    stream = await openCameraStream();
  }

  // Prefer native detector on Android/desktop when available; iOS → html5 (more reliable)
  if (supportsNativeBarcode() && !isIOS()) {
    try {
      await startNativeWithStream(container, stream);
      return;
    } catch (_) {
      stopStreamTracks(stream);
      stream = null;
      await releaseNativeCamera();
      container.innerHTML = '';
    }
  }

  try {
    await startHtml5Scanner(containerId, container, stream);
  } catch (err) {
    stopStreamTracks(stream);
    await stopScanner();
    throw err;
  }
}

export async function stopScanner() {
  detectedLock = false;
  onDetectedCallback = null;

  await releaseNativeCamera();

  if (html5Instance) {
    try {
      try {
        await html5Instance.stop();
      } catch (_) {
        /* already stopped */
      }
      try {
        html5Instance.clear();
      } catch (_) {
        /* ignore */
      }
    } catch (_) {
      /* ignore */
    }
    html5Instance = null;
  }

  const container = document.getElementById('scanner-viewport');
  if (container) {
    container.innerHTML = '';
    container.classList.remove('scanner-active');
  }

  activeMode = null;
}

export function isCameraSupported() {
  return !!(
    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia
  );
}

export function getScannerMode() {
  return activeMode;
}
