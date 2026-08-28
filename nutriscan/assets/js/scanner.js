let scannerInstance = null;
let onDetectedCallback = null;

export async function startScanner(containerId, onDetected) {
  onDetectedCallback = onDetected;
  const container = document.getElementById(containerId);
  if (!container) return;

  stopScanner();
  container.innerHTML = '';

  if (!window.Html5Qrcode) {
    throw new Error('SCANNER_LIB_MISSING');
  }

  scannerInstance = new Html5Qrcode(containerId);

  const config = {
    fps: 10,
    qrbox: { width: 280, height: 120 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
    ],
  };

  await scannerInstance.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      const barcode = decodedText.replace(/\D/g, '');
      if (barcode.length >= 8 && onDetectedCallback) {
        onDetectedCallback(barcode);
      }
    },
    () => {}
  );
}

export async function stopScanner() {
  if (scannerInstance) {
    try {
      const state = scannerInstance.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerInstance.stop();
      }
      scannerInstance.clear();
    } catch (_) {
      /* ignore stop errors */
    }
    scannerInstance = null;
  }
}

export function isCameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
