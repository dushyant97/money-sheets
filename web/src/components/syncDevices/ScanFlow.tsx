import { useState } from 'react';
import {
  decodeQrString,
  finishPairing,
  validateExpiration
} from '../../../../shared/pairing/pairingService';
import { PairingError, type PairingEnvelope, type PairingPayload } from '../../../../shared/pairing/types';
import type { TursoConfig } from '../../../../shared/storage/types';
import { PairingCodeInput } from './PairingCodeInput';
import { PairingPreview } from './PairingPreview';
import { QrScanner } from './QrScanner';

type Step = 'scanning' | 'code' | 'preview' | 'error';

const MAX_PIN_ATTEMPTS = 3;

/**
 * Drives the receiving side: scan -> enter PIN -> confirm -> save. Each failure
 * mode maps to its own copy, and unrecoverable errors offer a clean restart.
 */
export function ScanFlow({
  testConnection,
  applyCredentials,
  busy,
  onClose
}: {
  testConnection: (credentials: TursoConfig) => Promise<void>;
  applyCredentials: (credentials: TursoConfig) => Promise<void>;
  busy: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('scanning');
  const [envelope, setEnvelope] = useState<PairingEnvelope | null>(null);
  const [payload, setPayload] = useState<PairingPayload | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  function restart() {
    setEnvelope(null);
    setPayload(null);
    setCodeError(null);
    setFatalError(null);
    setAttempts(0);
    setStep('scanning');
  }

  function handleScan(raw: string) {
    try {
      const decoded = decodeQrString(raw);
      validateExpiration(decoded.exp);
      setEnvelope(decoded);
      setStep('code');
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : 'This pairing code could not be read.');
      setStep('error');
    }
  }

  async function handleCode(pin: string) {
    if (!envelope) return;
    setCodeError(null);
    try {
      const decoded = await finishPairing(envelope, pin);
      setPayload(decoded);
      setStep('preview');
    } catch (error) {
      const code = error instanceof PairingError ? error.code : 'invalid_payload';
      const message = error instanceof Error ? error.message : 'That did not work.';
      if (code === 'wrong_pin') {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_PIN_ATTEMPTS) {
          setFatalError('Too many incorrect attempts. Scan the code again to retry.');
          setStep('error');
        } else {
          setCodeError(message);
        }
      } else {
        setFatalError(message);
        setStep('error');
      }
    }
  }

  if (step === 'error') {
    return (
      <div className="scan-flow">
        <p className="status error">{fatalError}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary" onClick={restart}>
            Scan again
          </button>
        </div>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="scan-flow">
        <PairingCodeInput onSubmit={(pin) => void handleCode(pin)} busy={busy} error={codeError} />
        <button type="button" className="ghost sm" onClick={restart}>
          Scan a different code
        </button>
      </div>
    );
  }

  if (step === 'preview' && payload) {
    return (
      <div className="scan-flow">
        <PairingPreview
          payload={payload}
          onTest={testConnection}
          onSave={applyCredentials}
          busy={busy}
        />
      </div>
    );
  }

  return (
    <div className="scan-flow">
      <QrScanner
        onResult={handleScan}
        onError={(message) => {
          setFatalError(message);
          setStep('error');
        }}
      />
      <p className="muted pair-security-note">
        Point the camera at the QR code on your other device, then enter the 6-digit code it shows.
      </p>
    </div>
  );
}
