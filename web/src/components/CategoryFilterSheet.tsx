import { useEffect, useMemo, useState } from 'react';
import { getCategoryMeta } from '../ledger';
import { useEscToClose } from '../hooks/useEscToClose';

export const ALL_CATEGORIES = '__all__';

export type SheetCategory = { name: string; count: number };

/**
 * Mobile bottom sheet for choosing the active category filter. Includes an
 * "All Categories" option, a search field, and a radio-style selectable list.
 */
export function CategoryFilterSheet({
  open,
  categories,
  selected,
  onSelect,
  onClose
}: {
  open: boolean;
  categories: SheetCategory[];
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  useEscToClose(onClose, open);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((option) => option.name.toLowerCase().includes(q));
  }, [categories, query]);

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
      <div className="cat-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose category">
        <div className="cat-sheet-grab" />
        <h3 className="cat-sheet-title">Choose Category</h3>
        <p className="cat-sheet-sub">Filter transactions by category</p>
        <div className="cat-sheet-search">
          <span aria-hidden>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories"
            autoFocus
          />
        </div>
        <div className="cat-sheet-list">
          {!query.trim() ? row('All Categories', '📁', '#6c63ff', '__all__', ALL_CATEGORIES) : null}
          {filtered.map((option) => {
            const meta = getCategoryMeta(option.name);
            return row(option.name, meta.emoji, meta.color, option.name, option.name, option.count);
          })}
          {filtered.length === 0 ? <p className="cat-sheet-empty">No categories match “{query}”.</p> : null}
        </div>
      </div>
    </div>
  );
}
