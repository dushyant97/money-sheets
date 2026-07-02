import { useEffect, useRef, useState } from 'react';
import type { Transaction } from '../../../shared/finance';
import { formatSignedMoney } from '../ledger';

/**
 * Mobile transaction row with a ⋮ overflow menu for edit/delete.
 * Amount color indicates type — no separate Income/Expense label.
 */
export function MobileTxnRow({
  txn,
  primary,
  secondary,
  emoji,
  color,
  onEdit,
  onDelete
}: {
  txn: Transaction;
  primary: string;
  secondary: string;
  emoji: string;
  color: string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <article className="mrow">
      <span className="mrow-ico" style={{ backgroundColor: `${color}22`, color }}>
        {emoji}
      </span>
      <div className="mrow-body">
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </div>
      <em className={`mrow-amt ${txn.type}`}>{formatSignedMoney(txn.amount, txn.type, txn.currency)}</em>
      <div className="mrow-menu-wrap" ref={ref}>
        <button
          type="button"
          className="mrow-more"
          aria-label="More actions"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          ⋮
        </button>
        {open ? (
          <div className="mrow-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onEdit(txn);
                setOpen(false);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                void onDelete(txn);
                setOpen(false);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
