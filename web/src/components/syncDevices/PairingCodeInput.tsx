import { useEffect, useRef, useState } from 'react';
import { PAIRING_PIN_LENGTH } from '../../../../shared/pairing/constants';

/**
 * Numeric entry for the 6-digit pairing PIN. A single field (rather than six
 * boxes) keeps caret/paste behaviour predictable and still shows the numeric
 * keypad on mobile via `inputMode`.
 */
export function PairingCodeInput({
  onSubmit,
  busy,
  error
}: {
  onSubmit: (pin: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const complete = value.length === PAIRING_PIN_LENGTH;

  return (
    <form
      className="pairing-code"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete && !busy) onSubmit(value);
      }}
    >
      <label className="field-group">
        Enter the 6-digit pairing code
        <input
          ref={inputRef}
          className="pairing-code-field"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          maxLength={PAIRING_PIN_LENGTH}
          placeholder="------"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, PAIRING_PIN_LENGTH))}
        />
      </label>
      {error ? <span className="storage-test-result error">{error}</span> : null}
      <button type="submit" className="primary" disabled={!complete || busy}>
        {busy ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}
