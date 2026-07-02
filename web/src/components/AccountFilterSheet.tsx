import { useEffect, useMemo, useState } from 'react';
import { getAccountMeta } from '../ledger';
import { useEscToClose } from '../hooks/useEscToClose';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export const ALL_ACCOUNTS = '__all__';

export type SheetAccount = { name: string; count: number };

/**
 * Mobile bottom sheet for choosing the active account filter. Includes an
 * "All Accounts" option, a search field, and a radio-style selectable list.
 */
export function AccountFilterSheet({
  open,
  accounts,
  selected,
  onSelect,
  onClose
}: {
  open: boolean;
  accounts: SheetAccount[];
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  useEscToClose(onClose, open);
  useLockBodyScroll(open);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((option) => option.name.toLowerCase().includes(q));
  }, [accounts, query]);

  if (!open) return null;

  const choose = (name: string) => {
    onSelect(name);
    onClose();
  };

  const row = (name: string, emoji: string, color: string, key: string, value: string, count?: number) => {
    const on = selected === value;
    return (
      <button type="button" key={key} className={`cat-sheet-row ${on ? 'on' : ''}`} onClick={() => choose(value)}>
        <span className="csr-ico" style={{ backgroundColor: `${color}22`, color }}>{emoji}</span>
        <span className="csr-name">{name}</span>
        {typeof count === 'number' && count > 0 ? <span className="csr-count">{count}</span> : null}
        <span className={`csr-radio ${on ? 'on' : ''}`} aria-hidden />
      </button>
    );
  };

  return (
    <div className="modal-backdrop cat-sheet-backdrop" onClick={onClose}>
      <div className="cat-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose account">
        <div className="cat-sheet-grab" />
        <div className="cat-sheet-head">
          <div>
            <h3 className="cat-sheet-title">Choose Account</h3>
            <p className="cat-sheet-sub">Filter transactions by account</p>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cat-sheet-search">
          <span aria-hidden>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts"
          />
        </div>
        <div className="cat-sheet-list">
          {!query.trim() ? row('All Accounts', '🏦', '#9b6bff', '__all__', ALL_ACCOUNTS) : null}
          {filtered.map((option) => {
            const meta = getAccountMeta(option.name);
            return row(option.name, meta.emoji, meta.color, option.name, option.name, option.count);
          })}
          {filtered.length === 0 ? <p className="cat-sheet-empty">No accounts match “{query}”.</p> : null}
        </div>
      </div>
    </div>
  );
}
