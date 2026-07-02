import { useState } from 'react';
import type { Account } from '../../../../shared/finance';
import { getAccountMeta, useLedger } from '../../ledger';
import { useEscToClose } from '../../hooks/useEscToClose';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { CURRENCY_OPTIONS, EmojiColorPicker } from './shared';

type Props = {
  /** Editing an existing account, or omitted when creating a new one. */
  account?: Account;
  onClose: () => void;
};

/**
 * Add / edit a single account (name, emoji, colour, currency, opening balance).
 * Centred modal on desktop, bottom sheet on the mobile PWA.
 */
export function AccountEditorSheet({ account, onClose }: Props) {
  const { addAccount, updateAccount, deleteAccount, busy } = useLedger();
  const editing = Boolean(account);
  const meta = account ? getAccountMeta(account.name) : null;

  const [name, setName] = useState(account?.name ?? '');
  const [emoji, setEmoji] = useState(account?.emoji ?? '');
  const [color, setColor] = useState(account?.color ?? '');
  const [currency, setCurrency] = useState(account?.currency ?? 'INR');
  const [opening, setOpening] = useState(String(account?.openingBalance ?? ''));

  useEscToClose(onClose);
  useLockBodyScroll(true);

  async function save() {
    if (!name.trim()) return;
    if (editing && account) {
      await updateAccount(account.name, { name, emoji, color, currency, openingBalance: Number(opening) || 0 });
    } else {
      await addAccount(name, currency, opening, { emoji, color });
    }
    onClose();
  }

  async function remove() {
    if (!account) return;
    onClose();
    await deleteAccount(account.name);
  }

  return (
    <div className="modal-backdrop library-editor-backdrop" onClick={onClose}>
      <div className="modal library-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editing ? 'Edit account' : 'New account'}>
        <div className="library-editor-grab" />
        <div className="library-editor-head">
          <h3>{editing ? 'Edit account' : 'New account'}</h3>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="library-editor-preview">
          <span className="library-editor-ico" style={{ backgroundColor: `${(color || meta?.color) ?? '#9b6bff'}22`, color: color || meta?.color || 'var(--accent-2)' }}>
            {emoji || meta?.emoji || (name.trim().slice(0, 1).toUpperCase() || '🏦')}
          </span>
          <input
            className="library-editor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name"
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          />
        </div>

        <div className="account-edit-grid library-editor-grid">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="number" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>

        <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />

        <div className="library-editor-actions">
          {editing ? (
            <button type="button" className="ghost danger" onClick={() => void remove()} disabled={busy}>Delete</button>
          ) : <span />}
          <div className="library-editor-actions-end">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="primary" onClick={() => void save()} disabled={!name.trim() || busy}>
              {editing ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
