import { useEffect } from 'react';
import { useLedger } from '../ledger';

/**
 * Wire lightweight, throttled sync checks to natural browser lifecycle events.
 * Navigation between sections is handled separately (LedgerProvider wraps
 * `setMainTab`), and connectivity changes are handled by the provider's own
 * online/offline listener. This hook covers returning to the app:
 *  - `visibilitychange` (tab/PWA becomes visible)
 *  - `focus` (window regains focus)
 *  - `pageshow` (bfcache restore / PWA resume)
 *
 * Mount once near the app root. The provider's cooldown coalesces the bursts
 * these events can fire together.
 */
export function useSyncTriggers(): void {
  const { checkForUpdates } = useLedger();

  useEffect(() => {
    const check = () => {
      void checkForUpdates();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);

    // Check once on mount (app start / PWA launch).
    check();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
    };
  }, [checkForUpdates]);
}
