/** PWA install guide — similar to OXY Agenda */

const DISMISS_KEY = 'verdiscan_install_dismiss';
const SESSION_KEY = 'verdiscan_install_session';

let deferredPrompt = null;

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function initInstallGuide(lang, t) {
  const panel = document.getElementById('install-panel');
  const fab = document.getElementById('install-fab');
  const nativeBtn = document.getElementById('install-native-btn');
  const dismissBtn = document.getElementById('install-dismiss-btn');
  if (!panel) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (fab) fab.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    panel.hidden = true;
    if (fab) fab.hidden = true;
  });

  const showGuide = () => {
    if (isStandalone()) return;
    panel.hidden = false;
    const iosSteps = document.getElementById('install-ios-steps');
    const androidSteps = document.getElementById('install-android-steps');
    if (iosSteps) iosSteps.hidden = !isIOS();
    if (androidSteps) androidSteps.hidden = isIOS();
    if (nativeBtn) nativeBtn.hidden = !deferredPrompt;
  };

  if (fab) {
    fab.hidden = isStandalone();
    fab.addEventListener('click', showGuide);
  }

  if (nativeBtn) {
    nativeBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      panel.hidden = true;
      localStorage.setItem(DISMISS_KEY, '1');
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      panel.hidden = true;
      sessionStorage.setItem(SESSION_KEY, '1');
    });
  }

  // Auto-show once per session (like agenda)
  if (
    !isStandalone() &&
    !sessionStorage.getItem(SESSION_KEY) &&
    !localStorage.getItem(DISMISS_KEY)
  ) {
    setTimeout(showGuide, 1200);
  }
}
