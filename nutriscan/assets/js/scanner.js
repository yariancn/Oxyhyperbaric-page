/**
 * Fast barcode capture for VerdiScan — iOS + desktop Mac friendly.
 * Prefers native BarcodeDetector when reliable; always releases the camera on failure.
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

/** Laptop / desktop — usually only a front webcam (no rear "environment" cam) */
function isDesktop() {
  if (isIOS()) return false;
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return false;
  return !/Mobile/i.test(navigator.userAgent);
}

function nativeFormats() {
  try {
    if (typeof BarcodeDetector.getSupportedFormats === 'function') {
      const supported = BarcodeDetector.getSupportedFormats();
      if (Array.isArray(supported)) {
        const list = WANTED_FORMATS.filter((f) => supported.includes(f));
        return list.length ? list : undefined;
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

async function listVideoDevices() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
  } catch {
    return [];
  }
}

/**
 * Score cameras for close-up label / barcode reading.
 * Prefer rear + macro / ultra-wide (better near focus); avoid telephoto & selfie.
 */
function scoreCameraForCloseUp(device) {
  const label = `${device.label || ''}`.toLowerCase();
  let score = 0;

  // Rear / world-facing
  if (/back|rear|environment|trasera|posterior|world/i.test(label)) score += 40;
  if (/front|user|selfie|frontal|face/i.test(label)) score -= 50;

  // Close-range friendly optics
  if (/macro/i.test(label)) score += 50;
  if (/ultra[\s-]?wide|ultrawide|0\.5|uw\b/i.test(label)) score += 35;
  if (/wide|principal|main|camera 0|camera2 0/i.test(label)) score += 20;

  // Bad for near objects
  if (/tele|telephoto|periscope|zoom|3x|5x|10x/i.test(label)) score -= 40;

  // Dual/triple often = main module
  if (/dual|triple|quad/i.test(label) && !/front|selfie/i.test(label)) score += 10;

  return score;
}

function sortDevicesForCloseUp(devices) {
  return [...devices].sort((a, b) => scoreCameraForCloseUp(b) - scoreCameraForCloseUp(a));
}

/** Tune track for sharp close labels when the browser allows it */
async function applyCloseUpFocus(stream) {
  const track = stream?.getVideoTracks?.()?.[0];
  if (!track?.getCapabilities) return;

  let caps;
  try {
    caps = track.getCapabilities() || {};
  } catch {
    return;
  }

  const advanced = [];
  const basic = {};

  if (caps.focusMode?.includes?.('continuous')) {
    basic.focusMode = 'continuous';
  } else if (caps.focusMode?.includes?.('single-shot')) {
    basic.focusMode = 'single-shot';
  } else if (Array.isArray(caps.focusMode) && caps.focusMode.length) {
    basic.focusMode = caps.focusMode[0];
  }

  // Prefer nearer focus distance when supported (meters)
  if (caps.focusDistance && typeof caps.focusDistance.min === 'number') {
    const min = caps.focusDistance.min;
    const max = caps.focusDistance.max ?? min + 1;
    // ~12–20 cm if in that range; else bias toward minimum (closest)
    const near = Math.min(max, Math.max(min, 0.15));
    advanced.push({ focusDistance: near });
  }

  if (caps.zoom && typeof caps.zoom.min === 'number') {
    // Slight zoom helps barcodes; avoid telephoto-level zoom
    const zMin = caps.zoom.min;
    const zMax = caps.zoom.max ?? zMin;
    const idealZoom = Math.min(zMax, Math.max(zMin, zMin + (zMax - zMin) * 0.08));
    basic.zoom = idealZoom;
  }

  try {
    if (Object.keys(basic).length) {
      await track.applyConstraints({ advanced: Object.keys(basic).length ? [basic] : undefined, ...basic });
    }
  } catch {
    try {
      if (Object.keys(basic).length) await track.applyConstraints({ advanced: [basic] });
    } catch {
      /* ignore */
    }
  }

  if (advanced.length) {
    try {
      await track.applyConstraints({ advanced });
    } catch {
      /* ignore */
    }
  }
}

function phoneCloseUpConstraints(deviceId) {
  const video = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
    // Hint continuous AF for near subjects (ignored if unsupported)
    focusMode: { ideal: 'continuous' },
  };
  if (deviceId) video.deviceId = { exact: deviceId };
  return { audio: false, video };
}

async function getCameraStream() {
  let lastErr;

  if (isDesktop()) {
    const attempts = [
      { audio: false, video: { facingMode: 'user' } },
      { audio: false, video: { facingMode: { ideal: 'user' } } },
      { audio: false, video: true },
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
    ];
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await applyCloseUpFocus(stream);
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }
  } else {
    // Phones: warm up permission so labels appear in enumerateDevices
    try {
      const warm = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      warm.getTracks().forEach((t) => t.stop());
    } catch (err) {
      lastErr = err;
    }

    const devices = sortDevicesForCloseUp(await listVideoDevices());
    const rearish = devices.filter((d) => scoreCameraForCloseUp(d) > 0);
    const ordered = rearish.length ? rearish : devices;

    for (const device of ordered) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          phoneCloseUpConstraints(device.deviceId)
        );
        await applyCloseUpFocus(stream);
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }

    // Fallback without picking a specific lens
    const fallbacks = [
      phoneCloseUpConstraints(null),
      { audio: false, video: { facingMode: 'environment' } },
      { audio: false, video: true },
      { audio: false, video: { facingMode: 'user' } },
    ];
    for (const constraints of fallbacks) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await applyCloseUpFocus(stream);
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }
  }

  // Last resort: any remaining device
  const leftover = await listVideoDevices();
  for (const device of leftover) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: device.deviceId } },
      });
      await applyCloseUpFocus(stream);
      return stream;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('CAMERA_DENIED');
}

async function startNativeScanner(container) {
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

  const torchBtn = document.createElement('button');
  torchBtn.type = 'button';
  torchBtn.className = 'scanner-torch-btn';
  torchBtn.hidden = true;
  torchBtn.textContent = '🔦';
  torchBtn.setAttribute('aria-label', 'Flash');

  wrap.appendChild(video);
  wrap.appendChild(overlay);
  wrap.appendChild(torchBtn);
  container.appendChild(wrap);

  const stream = await getCameraStream();
  nativeStream = stream;
  nativeVideo = video;
  video.srcObject = stream;

  try {
    await video.play();
  } catch (err) {
    await releaseNativeCamera();
    throw err;
  }

  const track = stream.getVideoTracks()[0];
  try {
    const caps = track?.getCapabilities?.() || {};
    if (caps.torch) {
      let torchOn = false;
      torchBtn.hidden = false;
      torchBtn.addEventListener('click', async () => {
        torchOn = !torchOn;
        try {
          await track.applyConstraints({ advanced: [{ torch: torchOn }] });
          torchBtn.classList.toggle('is-on', torchOn);
        } catch (_) {
          /* ignore */
        }
      });
    }
  } catch (_) {
    /* capabilities optional */
  }

  let formats = nativeFormats();
  if (formats && typeof formats.then === 'function') {
    try {
      const supported = await formats;
      formats = WANTED_FORMATS.filter((f) => supported.includes(f));
      if (!formats.length) formats = undefined;
    } catch {
      formats = WANTED_FORMATS;
    }
  }

  let detector;
  try {
    detector = formats ? new BarcodeDetector({ formats }) : new BarcodeDetector();
  } catch {
    await releaseNativeCamera();
    throw new Error('BARCODE_DETECTOR_INIT');
  }

  let lastTs = 0;
  const intervalMs = 100;

  const tick = async (ts) => {
    if (!nativeVideo || detectedLock) return;
    nativeRaf = requestAnimationFrame(tick);
    if (ts - lastTs < intervalMs) return;
    lastTs = ts;
    if (video.readyState < 2) return;

    try {
      const codes = await detector.detect(video);
      if (codes?.length && codes[0].rawValue) {
        emitBarcode(codes[0].rawValue);
      }
    } catch (_) {
      /* transient */
    }
  };

  nativeRaf = requestAnimationFrame(tick);
  activeMode = 'native';
}

async function startHtml5Scanner(containerId, container) {
  if (!window.Html5Qrcode) {
    throw new Error('SCANNER_LIB_MISSING');
  }

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
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true,
    },
    verbose: false,
  });

  const config = {
    fps: isIOS() ? 15 : 20,
    qrbox: (w, h) => ({
      width: Math.floor(Math.min(w * 0.9, isDesktop() ? 480 : 400)),
      height: Math.floor(Math.min(h * (isDesktop() ? 0.4 : 0.28), isDesktop() ? 200 : 130)),
    }),
    disableFlip: false,
  };

  // Exact same camera config that worked on iPhone before — but prefer
  // close-up capable rear lenses when we can enumerate them.
  if (!isDesktop() && !isIOS()) {
    // Android: pick best close-up lens first via device list
    try {
      const cameras = await Html5Qrcode.getCameras();
      const ranked = sortDevicesForCloseUp(
        (cameras || []).map((c) => ({ deviceId: c.id, label: c.label || '', kind: 'videoinput' }))
      ).filter((c) => scoreCameraForCloseUp(c) > 0);
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
        } catch (_) {
          try {
            await html5Instance.stop();
          } catch (_) {
            /* ignore */
          }
        }
      }
    } catch (_) {
      /* fall through */
    }
  }


  const cameraAttempts = isDesktop()
    ? [{ facingMode: 'user' }, { facingMode: 'environment' }]
    : [{ facingMode: 'environment' }, { facingMode: 'user' }];

  let lastErr;
  for (const cameraConfig of cameraAttempts) {
    try {
      await html5Instance.start(cameraConfig, config, (decodedText) => emitBarcode(decodedText), () => {});
      activeMode = 'html5';
      // Best-effort close-up focus on the live track
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

  // Prefer macro / ultra-wide / rear by label score
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

export async function startScanner(containerId, onDetected) {
  detectedLock = false;

  const container = document.getElementById(containerId);
  if (!container) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('CAMERA_UNSUPPORTED');
  }

  // Release any previous session BEFORE wiring the new callback
  await stopScanner();
  onDetectedCallback = onDetected;
  container.innerHTML = '';

  // iPhone: html5-qrcode with simple facingMode (proven). Native path often
  // grabs the camera then fails and blocks the fallback — skip it on iOS.
  if (supportsNativeBarcode() && !isIOS()) {
    try {
      await startNativeScanner(container);
      return;
    } catch (_) {
      await releaseNativeCamera();
      container.innerHTML = '';
    }
  }

  try {
    await startHtml5Scanner(containerId, container);
  } catch (err) {
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
      const state = html5Instance.getState?.();
      if (
        typeof Html5QrcodeScannerState !== 'undefined' &&
        (state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED)
      ) {
        await html5Instance.stop();
      } else if (state === 2 || state === 3) {
        await html5Instance.stop();
      } else {
        try {
          await html5Instance.stop();
        } catch (_) {
          /* already stopped */
        }
      }
      html5Instance.clear();
    } catch (_) {
      /* ignore stop errors */
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
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function getScannerMode() {
  return activeMode;
}
