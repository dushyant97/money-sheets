import { useEffect } from 'react';

/**
 * Closes a dialog when the user presses Escape.
 * Pass the modal's close/cancel callback; `enabled` lets callers skip binding
 * for non-dismissible overlays.
 */
export function useEscToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}
