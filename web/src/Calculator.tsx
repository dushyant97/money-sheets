import { useEffect, useState } from 'react';
import { formatMoney } from '../../shared/uiHelpers';
import { applyCalcKey, evaluateExpression, OP_MAP } from '../../shared/calc';

const KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['.', '0', '⌫', '+']
] as const;

export function Calculator({
  initialValue,
  currency,
  onDone,
  onCancel
}: {
  initialValue: string;
  currency: string;
  onDone: (value: number) => void;
  onCancel: () => void;
}) {
  const [expr, setExpr] = useState(initialValue && Number(initialValue) ? String(initialValue) : '');

  const result = evaluateExpression(expr || '0');
  const hasOperator = /[+\-*/]/.test(expr.slice(1));

  function press(key: string) {
    setExpr((current) => applyCalcKey(current, key));
  }

  function clearAll() {
    setExpr('');
  }

  function done() {
    onDone(result < 0 ? 0 : result);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const { key } = event;
      if (key === 'Enter') { event.preventDefault(); done(); return; }
      if (key === 'Escape') { onCancel(); return; }
      if (key === 'Backspace') { press('⌫'); return; }
      if (key === 'c' || key === 'C') { clearAll(); return; }
      if (/^[0-9.]$/.test(key)) { press(key); return; }
      if (key === '+') { press('+'); return; }
      if (key === '-') { press('−'); return; }
      if (key === '*') { press('×'); return; }
      if (key === '/') { event.preventDefault(); press('÷'); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, result]);

  return (
    <div className="calc-backdrop" onClick={onCancel}>
      <div className="calc" onClick={(e) => e.stopPropagation()}>
        <div className="calc-display">
          <div className="calc-expr">{expr || '0'}</div>
          <div className="calc-result">
            {hasOperator ? '= ' : ''}{formatMoney(result, currency)}
          </div>
        </div>

        <div className="calc-keys">
          {KEYS.flat().map((key) => (
            <button
              key={key}
              className={`calc-key ${key in OP_MAP ? 'op' : ''} ${key === '⌫' ? 'fn' : ''}`}
              onClick={() => press(key)}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="calc-actions">
          <button className="calc-key fn wide" onClick={clearAll}>Clear</button>
          <button className="calc-key done wide" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  );
}
