import type { Transaction } from './finance';
import { activeTransactions } from './finance';

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  // Default expense categories
  'House Groceries': { emoji: '🛒', color: '#f59e0b' },
  'Food Outing': { emoji: '🍜', color: '#fbbf24' },
  'Transport & Fuel': { emoji: '⛽', color: '#34d399' },
  'Social Events': { emoji: '👫', color: '#60a5fa' },
  'House Enhancement': { emoji: '🛠️', color: '#a78bfa' },
  Shopping: { emoji: '👕', color: '#fb923c' },
  Doctor: { emoji: '🩺', color: '#4ade80' },
  Misc: { emoji: '📦', color: '#9aa3b2' },
  'Bills & Utilities': { emoji: '💸', color: '#f87171' },
  Education: { emoji: '📒', color: '#f472b6' },
  Travelling: { emoji: '✈️', color: '#22d3ee' },
  // Default income categories
  Salary: { emoji: '💰', color: '#3ddc84' },
  Gift: { emoji: '🎁', color: '#f472b6' },
  'Other Income': { emoji: '💵', color: '#34d399' },
  // Legacy categories (kept for older data / imports)
  Food: { emoji: '🍔', color: '#ff8a4c' },
  Transport: { emoji: '🚌', color: '#60a5fa' },
  Bills: { emoji: '📄', color: '#fbbf24' },
  Health: { emoji: '💊', color: '#34d399' },
  Other: { emoji: '📌', color: '#9aa3b2' }
};

export function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? { emoji: '📌', color: '#9aa3b2' };
}

export function formatMoney(amount: number, currency = 'INR') {
  const prefix = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return prefix ? `${prefix}${formatted}` : `${currency} ${formatted}`;
}

export function formatSignedMoney(amount: number, type: 'income' | 'expense', currency = 'INR') {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${formatMoney(amount, currency)}`;
}

function relativeDay(date: string): string | null {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (date === todayKey) return 'Today';
  if (date === yesterdayKey) return 'Yesterday';
  return null;
}

export function dateLabel(date: string) {
  const relative = relativeDay(date);
  if (relative) return relative;
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export type DateLabelParts = {
  /** Full weekday name, e.g. "Sunday". */
  weekday: string;
  /** Short weekday, e.g. "Sun". */
  weekdayShort: string;
  /** Numeric day of month, e.g. 15. */
  day: number;
  /** Formatted date, e.g. "15 Jun 2026". */
  dateText: string;
  /** "Today" / "Yesterday" when applicable, otherwise null. */
  relative: string | null;
};

export function dateLabelParts(date: string): DateLabelParts {
  const parsed = new Date(`${date}T00:00:00`);
  return {
    weekday: parsed.toLocaleDateString(undefined, { weekday: 'long' }),
    weekdayShort: parsed.toLocaleDateString(undefined, { weekday: 'short' }),
    day: parsed.getDate(),
    dateText: parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    relative: relativeDay(date)
  };
}

export function monthTitle(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export type TransactionGroup = {
  date: string;
  label: string;
  parts: DateLabelParts;
  items: Transaction[];
};

export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const rows = activeTransactions(transactions).sort((a, b) => b.date.localeCompare(a.date));
  const groups = new Map<string, Transaction[]>();

  for (const transaction of rows) {
    const bucket = groups.get(transaction.date) ?? [];
    bucket.push(transaction);
    groups.set(transaction.date, bucket);
  }

  return [...groups.entries()].map(([date, items]) => ({
    date,
    label: dateLabel(date),
    parts: dateLabelParts(date),
    items
  }));
}

export type PieSlice = {
  category: string;
  amount: number;
  percent: number;
  color: string;
  emoji: string;
  /** SVG path for the wedge (use with the same size/center passed in). */
  path: string;
  /** True when this slice fills the whole circle (render a full circle instead). */
  full: boolean;
};

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * Build SVG wedge paths for a pie chart from a category breakdown.
 * `size` is the SVG viewbox size (square); the pie is centered and fills it.
 */
export function categoryPieSlices(
  breakdown: Array<{ category: string; amount: number; percent: number }>,
  size = 200
): PieSlice[] {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const total = breakdown.reduce((sum, row) => sum + row.amount, 0) || 1;

  let angle = 0;
  return breakdown.map((row) => {
    const meta = getCategoryMeta(row.category);
    const sweep = (row.amount / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    const full = sweep >= 359.999;
    const startPt = polarPoint(cx, cy, r, end);
    const endPt = polarPoint(cx, cy, r, start);
    const largeArc = sweep > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArc} 0 ${endPt.x} ${endPt.y} Z`;

    return {
      category: row.category,
      amount: row.amount,
      percent: row.percent,
      color: meta.color,
      emoji: meta.emoji,
      path,
      full
    };
  });
}

export function donutSegments(
  breakdown: Array<{ category: string; amount: number; percent: number }>,
  colors: readonly string[]
) {
  let offset = 0;
  return breakdown.map((row, index) => {
    const segment = {
      category: row.category,
      amount: row.amount,
      percent: row.percent,
      color: colors[index % colors.length],
      dash: row.percent,
      offset
    };
    offset += row.percent;
    return segment;
  });
}
