export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  currency: string;
  account: string;
  category: string;
  note: string;
  createdAt: string;
  createdBy: string;
  source: 'mobile' | 'web';
  deleted?: boolean;
  updatedAt?: string;
  receiptUrl?: string;
};

export type TransactionFormInput = {
  date: string;
  type: TransactionType;
  amount: string;
  currency: string;
  account: string;
  category: string;
  note: string;
  receiptUrl?: string;
};

export type Account = {
  name: string;
  currency: string;
  openingBalance: number;
  active: boolean;
  /** Optional custom emoji shown on the account badge. */
  emoji?: string;
  /** Optional custom accent colour (hex). */
  color?: string;
};

export type Category = {
  name: string;
  type: TransactionType;
  active: boolean;
  /** Optional custom emoji shown wherever the category appears. */
  emoji?: string;
  /** Optional custom accent colour (hex). */
  color?: string;
};

export type Budget = {
  category: string;
  month: string;
  amount: number;
  currency: string;
};

export type TransactionFilters = {
  type?: TransactionType | 'all';
  category?: string;
  account?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
};

export type PeriodSummary = {
  label: string;
  income: number;
  expense: number;
  balance: number;
  count: number;
};

export type CategoryBreakdown = {
  category: string;
  amount: number;
  percent: number;
};

export type AccountBalance = {
  name: string;
  currency: string;
  openingBalance: number;
  income: number;
  expense: number;
  balance: number;
};

export type CalendarDay = {
  date: string;
  day: number;
  income: number;
  expense: number;
  count: number;
  inMonth: boolean;
};

export type BudgetProgress = {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  overBudget: boolean;
  currency: string;
};

export function isActiveTransaction(transaction: Transaction) {
  return !transaction.deleted;
}

export function activeTransactions(transactions: Transaction[]) {
  return transactions.filter(isActiveTransaction);
}

export function filterTransactions(transactions: Transaction[], filters: TransactionFilters) {
  const search = filters.search?.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (!filters.includeDeleted && transaction.deleted) return false;
    if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) return false;
    if (filters.category && transaction.category !== filters.category) return false;
    if (filters.account && transaction.account !== filters.account) return false;
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
    if (filters.dateTo && transaction.date > filters.dateTo) return false;
    if (search) {
      const haystack = [
        transaction.category,
        transaction.account,
        transaction.note,
        transaction.amount.toString(),
        transaction.currency
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Local-time `YYYY-MM-DD` key. Unlike `toISOString().slice(0, 10)`, this never
 * shifts the calendar day for timezones offset from UTC (e.g. IST is UTC+5:30,
 * where local midnight maps to the previous day in UTC).
 */
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function summarizePeriod(transactions: Transaction[], month = monthKey()): PeriodSummary {
  const rows = activeTransactions(transactions).filter((transaction) => transaction.date.startsWith(month));
  const income = rows
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = rows
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    label: month,
    income,
    expense,
    balance: income - expense,
    count: rows.length
  };
}

export function summarizeMonth(transactions: Transaction[], month = monthKey()) {
  return summarizePeriod(transactions, month);
}

export function summarizeWeek(transactions: Transaction[], referenceDate = new Date()): PeriodSummary {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startKey = dateKey(start);
  const endKey = dateKey(end);

  const rows = activeTransactions(transactions).filter(
    (transaction) => transaction.date >= startKey && transaction.date <= endKey
  );

  const income = rows
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = rows
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    label: `${startKey} to ${endKey}`,
    income,
    expense,
    balance: income - expense,
    count: rows.length
  };
}

export function summarizeByCategory(
  transactions: Transaction[],
  month = monthKey(),
  type: TransactionType = 'expense'
): CategoryBreakdown[] {
  const rows = activeTransactions(transactions).filter(
    (transaction) => transaction.date.startsWith(month) && transaction.type === type
  );
  const total = rows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const grouped = new Map<string, number>();

  for (const transaction of rows) {
    grouped.set(transaction.category, (grouped.get(transaction.category) ?? 0) + transaction.amount);
  }

  return Array.from(grouped.entries())
    .map(([category, amount]: [string, number]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0
    }))
    .sort((left, right) => right.amount - left.amount);
}

/** Number of days in a `YYYY-MM` month. */
export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 30;
  return new Date(year, monthNumber, 0).getDate();
}

/** Previous month key (`YYYY-MM`) relative to the given month. */
export function previousMonthKey(month = monthKey()): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year, monthNumber - 2, 1));
}

export type DailySeries = {
  /** Per-day income totals, index 0 = day 1. */
  income: number[];
  /** Per-day expense totals. */
  expense: number[];
  /** Per-day net (income - expense). */
  net: number[];
};

/** Per-day income / expense / net series for a month, used to draw card sparklines. */
export function dailySeries(transactions: Transaction[], month = monthKey()): DailySeries {
  const total = daysInMonth(month);
  const income = new Array<number>(total).fill(0);
  const expense = new Array<number>(total).fill(0);

  for (const transaction of activeTransactions(transactions)) {
    if (!transaction.date.startsWith(month)) continue;
    const day = Number(transaction.date.slice(8, 10));
    if (!day || day < 1 || day > total) continue;
    if (transaction.type === 'income') income[day - 1] += transaction.amount;
    else expense[day - 1] += transaction.amount;
  }

  const net = income.map((value, index) => value - expense[index]);
  return { income, expense, net };
}

export type AverageDailyStats = {
  /** Average net per day for the month. */
  averageDaily: number;
  /** Average net per day for the previous month. */
  prevAverageDaily: number;
  /** Percentage change vs the previous month (0 when the previous month is empty). */
  pctChange: number;
};

/** Average daily net for a month plus its percentage change versus the previous month. */
export function averageDailyStats(transactions: Transaction[], month = monthKey()): AverageDailyStats {
  const current = summarizeMonth(transactions, month);
  const prevMonth = previousMonthKey(month);
  const previous = summarizeMonth(transactions, prevMonth);

  const curDays = daysInMonth(month);
  const prevDays = daysInMonth(prevMonth);
  const averageDaily = curDays > 0 ? current.balance / curDays : 0;
  const prevAverageDaily = prevDays > 0 ? previous.balance / prevDays : 0;
  const pctChange =
    prevAverageDaily !== 0 ? ((averageDaily - prevAverageDaily) / Math.abs(prevAverageDaily)) * 100 : 0;

  return { averageDaily, prevAverageDaily, pctChange };
}

export type BalanceOptions = {
  /** When true, balances accumulate from earlier months (running balance). Default true (legacy behaviour). */
  carryForward?: boolean;
  /** Month (YYYY-MM) to scope balances to. Omit for all-time. */
  month?: string;
};

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  options: BalanceOptions = {}
): AccountBalance[] {
  const { carryForward = true, month } = options;
  const activeAccounts = accounts.filter((account) => account.active);

  return activeAccounts.map((account) => {
    let rows = activeTransactions(transactions).filter((transaction) => transaction.account === account.name);

    if (month) {
      rows = rows.filter((transaction) =>
        carryForward ? transaction.date.slice(0, 7) <= month : transaction.date.startsWith(month)
      );
    }

    const income = rows
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = rows
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      name: account.name,
      currency: account.currency,
      openingBalance: account.openingBalance,
      income,
      expense,
      balance: account.openingBalance + income - expense
    };
  });
}

/**
 * Net balance brought forward into a month from all earlier months,
 * including account opening balances. Returns 0 when carry-forward is off.
 */
export function carryOverBalance(
  accounts: Account[],
  transactions: Transaction[],
  month: string,
  carryForward: boolean
): number {
  if (!carryForward) return 0;

  const opening = accounts
    .filter((account) => account.active)
    .reduce((sum, account) => sum + account.openingBalance, 0);

  const before = activeTransactions(transactions).filter((transaction) => transaction.date.slice(0, 7) < month);
  const net = before.reduce(
    (sum, transaction) => sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount),
    0
  );

  return opening + net;
}

/** Transactions that belong to a given month (YYYY-MM). */
export function transactionsInMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((transaction) => transaction.date.startsWith(month));
}

export function buildCalendarMonth(
  transactions: Transaction[],
  year: number,
  monthIndex: number
): CalendarDay[] {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - startOffset);
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    const date = dateKey(current);
    const dayRows = activeTransactions(transactions).filter((transaction) => transaction.date === date);
    const income = dayRows
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = dayRows
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    days.push({
      date,
      day: current.getDate(),
      income,
      expense,
      count: dayRows.length,
      inMonth: current.getMonth() === monthIndex
    });
  }

  return days;
}

export function budgetProgressForMonth(
  budgets: Budget[],
  transactions: Transaction[],
  month = monthKey()
): BudgetProgress[] {
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  const expenses = summarizeByCategory(transactions, month, 'expense');

  return monthBudgets.map((budget) => {
    const spent = expenses.find((row) => row.category === budget.category)?.amount ?? 0;
    const remaining = budget.amount - spent;
    const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : spent > 0 ? 100 : 0;

    return {
      category: budget.category,
      budget: budget.amount,
      spent,
      remaining,
      percent,
      overBudget: spent > budget.amount,
      currency: budget.currency
    };
  });
}

export type TrendGranularity = 'week' | 'month' | 'year';

export type CategoryTrend = {
  category: string;
  /** One value per bucket, aligned with the returned `labels`. */
  points: number[];
  /** Sum of all points (used to rank categories). */
  total: number;
};

export type TrendResult = {
  /** Short labels for each time bucket, oldest first. */
  labels: string[];
  /** Totals across all categories for each bucket. */
  totals: number[];
  /** Per-category series, ranked by total (highest first). */
  categories: CategoryTrend[];
  /** Largest single value across the selected series (>= 1), for chart scaling. */
  max: number;
};

function startOfWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function bucketKeyFor(date: Date, granularity: TrendGranularity): string {
  if (granularity === 'year') return String(date.getFullYear());
  if (granularity === 'month') return monthKey(date);
  const start = startOfWeek(date);
  return start.toISOString().slice(0, 10);
}

function bucketLabelFor(key: string, granularity: TrendGranularity): string {
  if (granularity === 'year') return key;
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' });
  }
  const start = new Date(`${key}T00:00:00`);
  return start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function stepBucket(date: Date, granularity: TrendGranularity, steps: number): Date {
  const next = new Date(date);
  if (granularity === 'year') next.setFullYear(next.getFullYear() + steps);
  else if (granularity === 'month') next.setMonth(next.getMonth() + steps);
  else next.setDate(next.getDate() + steps * 7);
  return next;
}

/**
 * Month-over-month (or week/year) totals per category, used to draw trend lines.
 * Returns ordered buckets (oldest first) and the top `topN` categories by total spend,
 * plus any `categoryNames` entries that have no transactions in range.
 */
export function buildCategoryTrends(
  transactions: Transaction[],
  options: {
    granularity: TrendGranularity;
    type?: TransactionType;
    periods?: number;
    endDate?: Date;
    topN?: number;
    /** Ledger category names to include even when they have no transactions in range. */
    categoryNames?: string[];
  }
): TrendResult {
  const { granularity, type = 'expense', topN = 5 } = options;
  const periods = options.periods ?? (granularity === 'week' ? 8 : granularity === 'month' ? 6 : 5);
  const endDate = options.endDate ?? new Date();

  const anchor = granularity === 'week' ? startOfWeek(endDate) : endDate;
  const bucketKeys: string[] = [];
  const labels: string[] = [];
  for (let index = periods - 1; index >= 0; index -= 1) {
    const bucketDate = stepBucket(anchor, granularity, -index);
    const key = bucketKeyFor(bucketDate, granularity);
    bucketKeys.push(key);
    labels.push(bucketLabelFor(key, granularity));
  }
  const indexByKey = new Map(bucketKeys.map((key, index) => [key, index]));

  const totals: number[] = new Array<number>(periods).fill(0);
  const byCategory = new Map<string, number[]>();

  for (const transaction of activeTransactions(transactions)) {
    if (transaction.type !== type) continue;
    const parsed = new Date(`${transaction.date}T00:00:00`);
    const key = bucketKeyFor(parsed, granularity);
    const slot = indexByKey.get(key);
    if (slot === undefined) continue;

    totals[slot] += transaction.amount;
    const series = byCategory.get(transaction.category) ?? new Array<number>(periods).fill(0);
    series[slot] += transaction.amount;
    byCategory.set(transaction.category, series);
  }

  const zeroSeries = () => new Array<number>(periods).fill(0);
  const toTrend = (category: string, points: number[]): CategoryTrend => ({
    category,
    points,
    total: points.reduce((sum: number, value: number) => sum + value, 0)
  });

  for (const name of options.categoryNames ?? []) {
    if (!byCategory.has(name)) byCategory.set(name, zeroSeries());
  }

  const ranked = Array.from(byCategory.entries())
    .map(([category, points]) => toTrend(category, points))
    .sort((left, right) => right.total - left.total || left.category.localeCompare(right.category));

  const categories: CategoryTrend[] = ranked.filter((series) => series.total > 0).slice(0, topN);
  const included = new Set(categories.map((series) => series.category));
  for (const name of options.categoryNames ?? []) {
    if (!included.has(name)) {
      categories.push(toTrend(name, byCategory.get(name) ?? zeroSeries()));
      included.add(name);
    }
  }

  const max = Math.max(1, ...categories.flatMap((series) => series.points));

  return { labels, totals, categories, max };
}

export const EXPORT_HEADERS = [
  'id',
  'date',
  'type',
  'amount',
  'currency',
  'account',
  'category',
  'note',
  'createdAt',
  'createdBy',
  'source',
  'deleted',
  'updatedAt',
  'receiptUrl'
] as const;

/** Header row + one array per transaction, shared by CSV and XLSX exports. */
export function transactionsToRows(transactions: Transaction[]): (string | number)[][] {
  const rows = transactions.map((transaction) => [
    transaction.id,
    transaction.date,
    transaction.type,
    transaction.amount,
    transaction.currency,
    transaction.account,
    transaction.category,
    transaction.note,
    transaction.createdAt,
    transaction.createdBy,
    transaction.source,
    transaction.deleted ? 'TRUE' : 'FALSE',
    transaction.updatedAt ?? '',
    transaction.receiptUrl ?? ''
  ]);
  return [[...EXPORT_HEADERS], ...rows];
}

export function exportTransactionsCsv(transactions: Transaction[]) {
  const allRows = transactionsToRows(transactions);

  const escape = (value: string | number) => {
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return allRows.map((row) => row.map(escape).join(',')).join('\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
