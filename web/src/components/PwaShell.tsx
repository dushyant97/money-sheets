import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const INSTALL_DISMISS_KEY = 'money-sheets-pwa-install-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Registers the service worker and surfaces install / update prompts for the PWA.
 */
export function PwaShell() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateReady(true);
      },
      onOfflineReady() {
        // App shell cached — no UI needed; offline data already uses localStorage.
      }
    });
    reloadRef.current = () => void updateSW(true);
  }, []);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;

    const onBip = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setInstallEvent(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') dismissInstall();
    setInstallEvent(null);
  }

  if (updateReady) {
    return (
      <div className="pwa-banner update" role="status">
        <span>A new version of Money Sheets is ready.</span>
        <div className="pwa-banner-actions">
          <button type="button" className="primary sm" onClick={() => reloadRef.current()}>
            Reload
          </button>
          <button type="button" className="ghost sm" onClick={() => setUpdateReady(false)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (installEvent) {
    return (
      <div className="pwa-banner install" role="region" aria-label="Install app">
        <span>Install Money Sheets for quick access and offline use.</span>
        <div className="pwa-banner-actions">
          <button type="button" className="primary sm" onClick={() => void install()}>
            Install
          </button>
          <button type="button" className="ghost sm" onClick={dismissInstall}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="pwa-banner ios" role="region" aria-label="Add to Home Screen">
        <span>
          On iPhone/iPad: tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install.
        </span>
        <button type="button" className="ghost sm" onClick={dismissInstall}>
          Got it
        </button>
      </div>
    );
  }

  return null;
}
