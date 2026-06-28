import { useState } from 'react';
import { isTursoConfigComplete, isValidTursoUrl } from '../../../../shared/storage/prefs';
import type { TursoConfig } from '../../../../shared/storage/types';

/**
 * Power-user fallback: type the Turso database URL and auth token directly.
 * Collapsed by default in the Sync Other Devices panel. Delegates connection
 * testing and saving to the parent so the credential-store logic stays in one
 * place.
 */
export function AdvancedSyncFields({
  initial,
  onTest,
  onApply,
  busy
}: {
  initial: TursoConfig;
  onTest: (credentials: TursoConfig) => Promise<void>;
  onApply: (credentials: TursoConfig) => Promise<void>;
  busy: boolean;
}) {
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState(initial.authToken);
  const [showToken, setShowToken] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>(
    { state: 'idle' }
  );

  const credentials: TursoConfig = { url: url.trim(), authToken: token.trim() };
  const complete = isTursoConfigComplete(credentials);
  const urlInvalid = url.trim().length > 0 && !isValidTursoUrl(url);

  async function runTest() {
    setTest({ state: 'testing' });
    try {
      await onTest(credentials);
      setTest({ state: 'ok', message: 'Connection successful — schema is ready.' });
    } catch (error) {
      setTest({ state: 'error', message: error instanceof Error ? error.message : 'Connection failed.' });
    }
  }

  return (
    <div className="storage-config advanced-sync">
      <label className="field-group">
        Database URL
        <input
          type="text"
          placeholder="libsql://your-db-name.turso.io"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setTest({ state: 'idle' });
          }}
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
      {urlInvalid ? (
        <span className="storage-test-result error">Enter a libsql:// or https:// URL.</span>
      ) : null}

      <label className="field-group">
        Auth token
        <span className="storage-token-row">
          <input
            type={showToken ? 'text' : 'password'}
            placeholder="eyJ…"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTest({ state: 'idle' });
            }}
            spellCheck={false}
            autoCapitalize="none"
          />
          <button type="button" className="ghost sm" onClick={() => setShowToken((v) => !v)}>
            {showToken ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>

      <p className="storage-hint muted">Credentials are stored only on this device (in localStorage).</p>

      <div className="storage-test-row">
        <button
          type="button"
          className="ghost sm"
          onClick={() => void runTest()}
          disabled={!complete || test.state === 'testing'}
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
        onClick={() => void onApply(credentials)}
        disabled={!complete || busy}
      >
        Save &amp; Reload
      </button>
    </div>
  );
}
