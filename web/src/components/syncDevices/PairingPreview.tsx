import { useState } from 'react';
import { credentialsFromPayload } from '../../../../shared/pairing/pairingService';
import { dbNameFromUrl } from '../../../../shared/pairing/payload';
import type { PairingPayload } from '../../../../shared/pairing/types';
import { maskToken } from '../../../../shared/storage/prefs';
import type { TursoConfig } from '../../../../shared/storage/types';

/**
 * Final confirmation before joining: shows the decoded (masked) credentials and
 * lets the user verify connectivity, then save. Never reveals the raw token.
 */
export function PairingPreview({
  payload,
  onTest,
  onSave,
  busy
}: {
  payload: PairingPayload;
  onTest: (credentials: TursoConfig) => Promise<void>;
  onSave: (credentials: TursoConfig) => Promise<void>;
  busy: boolean;
}) {
  const credentials = credentialsFromPayload(payload);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>(
    { state: 'idle' }
  );

  async function runTest() {
    setTest({ state: 'testing' });
    try {
      await onTest(credentials);
      setTest({ state: 'ok', message: 'Connection successful — ready to join.' });
    } catch (error) {
      setTest({ state: 'error', message: error instanceof Error ? error.message : 'Connection failed.' });
    }
  }

  return (
    <div className="pair-preview">
      <dl className="pair-summary">
        <div className="pair-summary-row">
          <dt>Database</dt>
          <dd>{dbNameFromUrl(payload.databaseUrl)}</dd>
        </div>
        <div className="pair-summary-row">
          <dt>Shared from</dt>
          <dd>{payload.deviceName}</dd>
        </div>
        <div className="pair-summary-row">
          <dt>Token</dt>
          <dd className="pair-summary-token">{maskToken(payload.token)}</dd>
        </div>
      </dl>

      <div className="storage-test-row">
        <button
          type="button"
          className="ghost sm"
          onClick={() => void runTest()}
          disabled={busy || test.state === 'testing'}
        >
          {test.state === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {test.state === 'ok' ? <span className="storage-test-result ok">{test.message}</span> : null}
        {test.state === 'error' ? (
          <span className="storage-test-result error">{test.message}</span>
        ) : null}
      </div>

      <button
        type="button"
        className="primary"
        onClick={() => void onSave(credentials)}
        disabled={busy}
      >
        Save &amp; join sync
      </button>
      <p className="muted pair-security-note">
        Joining switches this device to cloud sync and reloads the app.
      </p>
    </div>
  );
}
