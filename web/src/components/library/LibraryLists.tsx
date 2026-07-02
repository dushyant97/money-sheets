import { useEffect, useState } from 'react';
import type { Account, Category } from '../../../../shared/finance';
import { computeAccountBalances, formatMoney, getAccountMeta, getCategoryMeta, useLedger } from '../../ledger';

/** A single tappable library row: icon tile, name, edit pencil, chevron. */
function LibraryRow({
  emoji,
  color,
  name,
  meta,
  onEdit
}: {
  emoji: string;
  color: string;
  name: string;
  meta?: string;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="library-row" onClick={onEdit}>
      <span className="library-row-ico" style={{ backgroundColor: `${color}22`, color }}>{emoji}</span>
      <span className="library-row-body">
        <strong>{name}</strong>
        {meta ? <span className="muted">{meta}</span> : null}
      </span>
      <span className="library-row-edit" aria-hidden>✏️</span>
      <span className="library-row-caret" aria-hidden>›</span>
    </button>
  );
}

/** Collapse toggle styled like the Dashboard "View all" button. */
function LibraryViewMore({ hidden, expanded, onToggle }: { hidden: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="view-all-btn" onClick={onToggle}>
      {expanded ? 'Show less ⌃' : `View more (${hidden} more) ⌄`}
    </button>
  );
}

/**
 * Grouped expense/income category list, filtered by an optional search term.
 * When `limit` is set (desktop panel), only the first `limit` rows show until
 * the user expands; the mobile screen omits `limit` to show the full list.
 */
export function CategoryLibraryList({
  search = '',
  limit,
  onEdit
}: {
  search?: string;
  limit?: number;
  onEdit: (category: Category) => void;
}) {
  const { categories } = useLedger();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [search]);

  const q = search.trim().toLowerCase();
  const match = (c: Category) => !q || c.name.toLowerCase().includes(q);
  const expense = categories.filter((c) => c.type === 'expense' && match(c));
  const income = categories.filter((c) => c.type === 'income' && match(c));

  const total = expense.length + income.length;
  const collapsed = limit != null && !expanded && total > limit;
  const expenseShown = collapsed ? expense.slice(0, limit) : expense;
  const incomeShown = collapsed ? income.slice(0, Math.max(0, limit - expense.length)) : income;

  return (
    <div className="library-list">
      <div className="library-section">
        <span className="library-section-label expense">Expense categories · {expense.length}</span>
        {expense.length === 0 ? <p className="library-empty muted">None yet.</p> : null}
        {expenseShown.map((c) => {
          const meta = getCategoryMeta(c.name);
          return <LibraryRow key={c.name} emoji={c.emoji || meta.emoji} color={c.color || meta.color} name={c.name} onEdit={() => onEdit(c)} />;
        })}
      </div>
      {incomeShown.length > 0 || !collapsed ? (
        <div className="library-section">
          <span className="library-section-label income">Income categories · {income.length}</span>
          {income.length === 0 ? <p className="library-empty muted">None yet.</p> : null}
          {incomeShown.map((c) => {
            const meta = getCategoryMeta(c.name);
            return <LibraryRow key={c.name} emoji={c.emoji || meta.emoji} color={c.color || meta.color} name={c.name} onEdit={() => onEdit(c)} />;
          })}
        </div>
      ) : null}
      {limit != null && total > limit ? (
        <LibraryViewMore hidden={total - limit} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}
    </div>
  );
}

/** Account list with running balances, filtered by an optional search term. */
export function AccountLibraryList({
  search = '',
  limit,
  onEdit
}: {
  search?: string;
  limit?: number;
  onEdit: (account: Account) => void;
}) {
  const { accounts, transactions } = useLedger();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [search]);

  const balances = computeAccountBalances(accounts, transactions);
  const q = search.trim().toLowerCase();
  const rows = accounts.filter((a) => !q || a.name.toLowerCase().includes(q));

  const collapsed = limit != null && !expanded && rows.length > limit;
  const rowsShown = collapsed ? rows.slice(0, limit) : rows;

  return (
    <div className="library-list">
      <div className="library-section">
        <span className="library-section-label">Accounts · {rows.length}</span>
        {rows.length === 0 ? <p className="library-empty muted">No accounts yet.</p> : null}
        {rowsShown.map((account) => {
          const meta = getAccountMeta(account.name);
          const balance = balances.find((b) => b.name === account.name)?.balance ?? account.openingBalance;
          return (
            <LibraryRow
              key={account.name}
              emoji={account.emoji || meta.emoji || account.name.slice(0, 1).toUpperCase()}
              color={account.color || meta.color}
              name={account.name}
              meta={`${account.currency} · ${formatMoney(balance, account.currency)}`}
              onEdit={() => onEdit(account)}
            />
          );
        })}
      </div>
      {limit != null && rows.length > limit ? (
        <LibraryViewMore hidden={rows.length - limit} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}
    </div>
  );
}
