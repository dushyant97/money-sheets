import type { Transaction } from './finance';
import { activeTransactions, dateKey } from './finance';

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

/**
 * User-defined overrides for category emoji/colour, registered by the app after
 * loading the ledger so renamed/imported categories can carry custom styling.
 */
const CATEGORY_OVERRIDES = new Map<string, { emoji?: string; color?: string }>();

export function setCategoryMetaOverrides(
  categories: Array<{ name: string; emoji?: string; color?: string }>
) {
  CATEGORY_OVERRIDES.clear();
  for (const category of categories) {
    if (category.emoji || category.color) {
      CATEGORY_OVERRIDES.set(category.name, { emoji: category.emoji, color: category.color });
    }
  }
}

export function getCategoryMeta(category: string) {
  const base = CATEGORY_META[category] ?? { emoji: '📌', color: '#9aa3b2' };
  const override = CATEGORY_OVERRIDES.get(category);
  if (!override) return base;
  return {
    emoji: override.emoji || base.emoji,
    color: override.color || base.color
  };
}

/** Stable, pleasant accent palette for account badges keyed off the name. */
const ACCOUNT_PALETTE = [
  '#4f7cff',
  '#22c08b',
  '#ff7a45',
  '#9b6bff',
  '#f2495c',
  '#22c3e6',
  '#ffb020',
  '#ff5d8f'
] as const;

const ACCOUNT_OVERRIDES = new Map<string, { emoji?: string; color?: string }>();

export function setAccountMetaOverrides(
  accounts: Array<{ name: string; emoji?: string; color?: string }>
) {
  ACCOUNT_OVERRIDES.clear();
  for (const account of accounts) {
    if (account.emoji || account.color) {
      ACCOUNT_OVERRIDES.set(account.name, { emoji: account.emoji, color: account.color });
    }
  }
}

export function getAccountMeta(name: string): { emoji: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const base = { emoji: '', color: ACCOUNT_PALETTE[hash % ACCOUNT_PALETTE.length] };
  const override = ACCOUNT_OVERRIDES.get(name);
  if (!override) return base;
  return {
    emoji: override.emoji || base.emoji,
    color: override.color || base.color
  };
}

/**
 * High-contrast qualitative palette for charts. Assigned by position so that
 * adjacent slices/lines stay easy to tell apart (pink, blue, yellow, green…),
 * instead of relying on category colours that cluster around oranges.
 */
export const CHART_PALETTE = [
  '#4f7cff', // blue
  '#ff5d8f', // pink
  '#ffb020', // amber
  '#22c08b', // green
  '#9b6bff', // purple
  '#ff7a45', // orange
  '#22c3e6', // cyan
  '#f2495c', // red
  '#7ed957', // lime
  '#c44dff' // magenta
] as const;

export function chartColorAt(index: number) {
  return CHART_PALETTE[((index % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}

/** Compact money for chart axes: 1.2k / 3.4L / 1.1Cr. */
export function formatAxisMoney(amount: number, currency = 'INR') {
  const prefix = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  const abs = Math.abs(amount);
  let text: string;
  if (abs >= 1e7) text = `${(amount / 1e7).toFixed(1)}Cr`;
  else if (abs >= 1e5) text = `${(amount / 1e5).toFixed(1)}L`;
  else if (abs >= 1e3) text = `${(amount / 1e3).toFixed(amount % 1e3 === 0 ? 0 : 1)}k`;
  else text = `${Math.round(amount)}`;
  return `${prefix}${text}`;
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
  const todayKey = dateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

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

export type RingArc = {
  category: string;
  amount: number;
  percent: number;
  color: string;
  emoji: string;
  /** SVG arc path for the segment stroke. */
  path: string;
  /** True when this segment fills the entire ring (render a full circle stroke). */
  full: boolean;
  /** Whether a percentage pill should be drawn (false for ~0% slivers). */
  showLabel: boolean;
  /** Position for a floating percentage pill (collision-resolved). */
  labelX: number;
  labelY: number;
};

/**
 * Build rounded stroke arcs for a donut ring (thick ring with gaps between
 * segments), plus collision-resolved coordinates to anchor floating percentage
 * pills for *every* slice. Pass `colors` (aligned to the breakdown order) to
 * override the per-slice hue. `labelPad` insets the ring to leave room for the
 * pills inside the viewbox.
 */
export function categoryRingArcs(
  breakdown: Array<{ category: string; amount: number; percent: number }>,
  options: {
    size?: number;
    thickness?: number;
    gapDeg?: number;
    labelRadius?: number;
    labelPad?: number;
    colors?: readonly string[];
  } = {}
): RingArc[] {
  const size = options.size ?? 220;
  const thickness = options.thickness ?? 26;
  const gapDeg = options.gapDeg ?? 4;
  const labelPad = options.labelPad ?? 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2 - labelPad;
  const labelRadius = options.labelRadius ?? r + thickness / 2 + 14;
  const total = breakdown.reduce((sum, row) => sum + row.amount, 0) || 1;
  const single = breakdown.length === 1;

  // First pass: geometry + midpoint angle for each slice.
  let angle = 0;
  const built = breakdown.map((row, index) => {
    const meta = getCategoryMeta(row.category);
    const sweep = (row.amount / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    const full = sweep >= 359.999;
    const pad = single || full ? 0 : Math.min(gapDeg / 2, sweep / 2 - 0.5);
    const a0 = start + pad;
    const a1 = Math.max(a0 + 0.01, end - pad);
    const startPt = polarPoint(cx, cy, r, a0);
    const endPt = polarPoint(cx, cy, r, a1);
    const largeArc = a1 - a0 > 180 ? 1 : 0;
    const path = `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

    const mid = (start + end) / 2;

    return {
      category: row.category,
      amount: row.amount,
      percent: row.percent,
      color: options.colors?.[index] ?? meta.color,
      emoji: meta.emoji,
      path,
      full,
      mid
    };
  });

  // Second pass: place pills at each midpoint, nudging the radius outward when
  // a pill would overlap one already placed (keeps clustered small slices apart).
  const minGap = 24;
  const step = 13;
  const maxNudges = 4;
  const placed: Array<{ x: number; y: number }> = [];

  return built.map((arc): RingArc => {
    if (arc.percent < 0.5) {
      const pt = polarPoint(cx, cy, labelRadius, arc.mid);
      return { ...arc, showLabel: false, labelX: pt.x, labelY: pt.y };
    }
    let rad = labelRadius;
    let pt = polarPoint(cx, cy, rad, arc.mid);
    let tries = 0;
    while (
      tries < maxNudges &&
      placed.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < minGap)
    ) {
      rad += step;
      pt = polarPoint(cx, cy, rad, arc.mid);
      tries += 1;
    }
    placed.push(pt);
    return { ...arc, showLabel: true, labelX: pt.x, labelY: pt.y };
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
