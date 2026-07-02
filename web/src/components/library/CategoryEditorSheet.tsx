import { useState } from 'react';
import type { Category, TransactionType } from '../../../../shared/finance';
import { getCategoryMeta, useLedger } from '../../ledger';
import { useEscToClose } from '../../hooks/useEscToClose';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { EmojiColorPicker } from './shared';

type Props = {
  /** Editing an existing category, or omitted when creating a new one. */
  category?: Category;
  /** Pre-selected type when creating (mirrors the active Library tab). */
  defaultType?: TransactionType;
  onClose: () => void;
};

/**
 * Add / edit a single category. Renders as a centred modal on desktop and a
 * bottom sheet on the mobile PWA (see `.library-editor` styles). Delete lives
 * in the footer and reuses the ledger's confirm flow.
 */
export function CategoryEditorSheet({ category, defaultType = 'expense', onClose }: Props) {
  const { addCategory, updateCategory, deleteCategory, busy } = useLedger();
  const editing = Boolean(category);
  const meta = category ? getCategoryMeta(category.name) : null;

  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<TransactionType>(category?.type ?? defaultType);
  const [emoji, setEmoji] = useState(category?.emoji ?? '');
  const [color, setColor] = useState(category?.color ?? '');

  useEscToClose(onClose);
  useLockBodyScroll(true);

  async function save() {
    if (!name.trim()) return;
    if (editing && category) {
      await updateCategory(category.name, { name, emoji, color });
    } else {
      await addCategory(name, type, { emoji, color });
    }
    onClose();
  }

  async function remove() {
    if (!category) return;
    onClose();
    await deleteCategory(category.name);
  }

  return (
    <div className="modal-backdrop library-editor-backdrop" onClick={onClose}>
      <div className="modal library-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editing ? 'Edit category' : 'New category'}>
        <div className="library-editor-grab" />
        <div className="library-editor-head">
          <h3>{editing ? 'Edit category' : 'New category'}</h3>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="library-editor-preview">
          <span className="library-editor-ico" style={{ backgroundColor: `${(color || meta?.color) ?? '#6c63ff'}22`, color: color || meta?.color || 'var(--accent)' }}>
            {emoji || meta?.emoji || '🗂️'}
          </span>
          <input
            className="library-editor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          />
        </div>

        {!editing ? (
          <div className="type-toggle compact library-editor-type">
            <button type="button" className={type === 'expense' ? 'toggle active expense' : 'toggle'} onClick={() => setType('expense')}>Expense</button>
            <button type="button" className={type === 'income' ? 'toggle active income' : 'toggle'} onClick={() => setType('income')}>Income</button>
          </div>
        ) : null}

        <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />

        <div className="library-editor-actions">
          {editing ? (
            <button type="button" className="ghost danger" onClick={() => void remove()} disabled={busy}>Delete</button>
          ) : <span />}
          <div className="library-editor-actions-end">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="primary" onClick={() => void save()} disabled={!name.trim() || busy}>
              {editing ? 'Save changes' : 'Add category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
