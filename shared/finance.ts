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
};

export type Category = {
  name: string;
  type: TransactionType;
  active: boolean;
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

  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);

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

  return [...grouped.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0
    }))
    .sort((left, right) => right.amount - left.amount);
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
    const date = current.toISOString().slice(0, 10);
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

export function exportTransactionsCsv(transactions: Transaction[]) {
  const headers = [
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
  ];

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

  const escape = (value: string | number) => {
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
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
