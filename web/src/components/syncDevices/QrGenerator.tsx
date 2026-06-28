import { QRCodeSVG } from 'qrcode.react';
import { usePairingSession } from '../../hooks/usePairingSession';
import type { TursoConfig } from '../../../../shared/storage/types';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Renders the live pairing QR plus the out-of-band PIN and an expiry countdown.
 * The PIN is shown as text next to the QR and is deliberately NOT encoded in it.
 */
export function QrGenerator({
  credentials,
  deviceName
}: {
  credentials: TursoConfig;
  deviceName: string;
}) {
  const session = usePairingSession(credentials, deviceName, true);

  if (session.status === 'error') {
    return (
      <div className="pair-generator">
        <p className="status error">{session.error}</p>
        <button type="button" className="primary" onClick={session.regenerate}>
          Try again
        </button>
      </div>
    );
  }

  if (session.status === 'generating' || !session.qrString) {
    return (
      <div className="pair-generator">
        <div className="pair-qr-frame loading">
          <span className="muted">Generating…</span>
        </div>
      </div>
    );
  }

  const expired = session.status === 'expired';

  return (
    <div className="pair-generator">
      <div className={`pair-qr-frame ${expired ? 'expired' : ''}`}>
        <QRCodeSVG value={session.qrString} size={232} level="M" marginSize={2} />
        {expired ? (
          <div className="pair-qr-expired-overlay">
            <span>Expired</span>
          </div>
        ) : null}
      </div>

      <dl className="pair-meta">
        <div className="pair-meta-row">
          <dt>Pairing code</dt>
          <dd className="pair-pin">{session.pin}</dd>
        </div>
        <div className="pair-meta-row">
          <dt>QR expires in</dt>
          <dd className={expired ? 'pair-countdown danger' : 'pair-countdown'}>
            {expired ? '0:00' : formatCountdown(session.secondsLeft)}
          </dd>
        </div>
      </dl>

      <button type="button" className={expired ? 'primary' : 'ghost'} onClick={session.regenerate}>
        {expired ? 'Generate a new code' : 'Regenerate'}
      </button>

      <p className="muted pair-security-note">
        Only show this screen to a device you own. The code expires automatically and the 6-digit PIN
        is needed to read it.
      </p>
    </div>
  );
}
