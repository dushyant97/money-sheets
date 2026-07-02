import { useEffect } from 'react';

/**
 * Prevents the page behind a modal/sheet from scrolling while `enabled`.
 * Restores the previous body overflow on cleanup.
 */
export function useLockBodyScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [enabled]);
}
