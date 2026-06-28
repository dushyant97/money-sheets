import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePairingQr } from '../../../shared/pairing/pairingService';
import type { TursoConfig } from '../../../shared/storage/types';

export type PairingSessionStatus = 'generating' | 'ready' | 'expired' | 'error';

export type PairingSession = {
  status: PairingSessionStatus;
  qrString: string | null;
  pin: string | null;
  /** Whole seconds until the current QR expires (0 once expired). */
  secondsLeft: number;
  error: string | null;
  /** Build a brand-new QR + PIN, invalidating the previous one. */
  regenerate: () => void;
};

/**
 * Owns the lifecycle of a generated pairing QR: it builds one when `active`,
 * ticks a countdown, flips to `expired` at zero, and regenerates on demand.
 * Credentials should be complete before this is activated.
 */
export function usePairingSession(
  credentials: TursoConfig,
  deviceName: string,
  active: boolean
): PairingSession {
  const [state, setState] = useState<{
    status: PairingSessionStatus;
    qrString: string | null;
    pin: string | null;
    expiresAtMs: number | null;
    error: string | null;
  }>({ status: 'generating', qrString: null, pin: null, expiresAtMs: null, error: null });
  const [now, setNow] = useState(() => Date.now());

  const credUrl = credentials.url;
  const credToken = credentials.authToken;
  const generatingRef = useRef(false);

  const regenerate = useCallback(() => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setState((s) => ({ ...s, status: 'generating', error: null }));
    void generatePairingQr({ credentials: { url: credUrl, authToken: credToken }, deviceName })
      .then(({ qrString, pin, expiresAt }) => {
        setState({
          status: 'ready',
          qrString,
          pin,
          expiresAtMs: new Date(expiresAt).getTime(),
          error: null
        });
        setNow(Date.now());
      })
      .catch((error: unknown) => {
        setState({
          status: 'error',
          qrString: null,
          pin: null,
          expiresAtMs: null,
          error: error instanceof Error ? error.message : 'Could not create a pairing code.'
        });
      })
      .finally(() => {
        generatingRef.current = false;
      });
  }, [credUrl, credToken, deviceName]);

  useEffect(() => {
    if (active) regenerate();
  }, [active, regenerate]);

  useEffect(() => {
    if (!active || state.status !== 'ready') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, state.status]);

  const secondsLeft = state.expiresAtMs
    ? Math.max(0, Math.round((state.expiresAtMs - now) / 1000))
    : 0;
  const expired = state.status === 'ready' && secondsLeft <= 0;

  return {
    status: expired ? 'expired' : state.status,
    qrString: state.qrString,
    pin: state.pin,
    secondsLeft,
    error: state.error,
    regenerate
  };
}
