import type { Account, Budget, Category, Transaction } from './finance';
import { LEDGER_STORAGE_VERSION, type LedgerSnapshot } from './ledgerStore';

const EXPENSE_CATS: Array<{ name: string; emoji: string; color: string }> = [
  { name: 'Groceries', emoji: '🛒', color: '#f59e0b' },
  { name: 'Dining Out', emoji: '🍜', color: '#fbbf24' },
  { name: 'Transport', emoji: '🚌', color: '#34d399' },
  { name: 'Shopping', emoji: '👕', color: '#fb923c' },
  { name: 'Bills & Utilities', emoji: '💸', color: '#f87171' },
  { name: 'Health', emoji: '🩺', color: '#4ade80' },
  { name: 'Entertainment', emoji: '🎮', color: '#60a5fa' },
  { name: 'Travel', emoji: '✈️', color: '#22d3ee' },
  { name: 'Subscriptions', emoji: '📱', color: '#a78bfa' },
  { name: 'Misc', emoji: '📦', color: '#9aa3b2' }
];

const INCOME_CATS: Array<{ name: string; emoji: string; color: string }> = [
  { name: 'Salary', emoji: '💰', color: '#3ddc84' },
  { name: 'Freelance', emoji: '💼', color: '#60a5fa' },
  { name: 'Interest', emoji: '🏦', color: '#34d399' },
  { name: 'Gift', emoji: '🎁', color: '#f472b6' }
];

const ACCOUNTS: Array<{ name: string; emoji: string; color: string; opening: number }> = [
  { name: 'HDFC Bank', emoji: '🏦', color: '#4f7cff', opening: 92000 },
  { name: 'Cash Wallet', emoji: '💵', color: '#22c08b', opening: 8500 },
  { name: 'Credit Card', emoji: '💳', color: '#9b6bff', opening: 0 },
  { name: 'Savings', emoji: '🪙', color: '#ffb020', opening: 145000 }
];

const EXPENSE_NOTES = [
  'Weekly shop',
  'Metro recharge',
  'Coffee with friends',
  'Amazon order',
  'Electricity bill',
  'Pharmacy',
  'Movie night',
  'Flight booking',
  'Netflix',
  'Cab ride',
  'Restaurant',
  'Fuel',
  'Gym membership',
  'Birthday gift',
  'Home repair'
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Build a demo ledger with ~6 months of varied income/expense transactions,
 * custom categories, accounts, and sample budgets — for app showcase only.
 */
export function buildShowcaseLedger(): LedgerSnapshot {
  const now = new Date();
  const accounts: Account[] = ACCOUNTS.map((a) => ({
    name: a.name,
    currency: 'INR',
    openingBalance: a.opening,
    active: true,
    emoji: a.emoji,
    color: a.color
  }));

  const categories: Category[] = [
    ...EXPENSE_CATS.map((c) => ({ name: c.name, type: 'expense' as const, active: true, emoji: c.emoji, color: c.color })),
    ...INCOME_CATS.map((c) => ({ name: c.name, type: 'income' as const, active: true, emoji: c.emoji, color: c.color }))
  ];

  const transactions: Transaction[] = [];
  let seq = 0;

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const lastDay = daysInMonth(year, month);

    // Monthly salary
    const salaryDay = Math.min(28, 1 + Math.floor(rand(0, 4)));
    transactions.push(makeTxn(seq++, dateKey(year, month, salaryDay), 'income', pick(INCOME_CATS).name, pick(ACCOUNTS).name, rand(72000, 98000), 'Monthly salary'));

    // Occasional freelance / interest
    if (Math.random() > 0.45) {
      transactions.push(
        makeTxn(
          seq++,
          dateKey(year, month, Math.min(lastDay, 10 + Math.floor(rand(0, 12)))),
          'income',
          pick(['Freelance', 'Interest', 'Gift']),
          pick(ACCOUNTS).name,
          rand(3000, 18000),
          pick(['Side project', 'FD interest', 'Family gift'])
        )
      );
    }

    const expenseCount = 22 + Math.floor(rand(0, 18));
    for (let i = 0; i < expenseCount; i += 1) {
      const day = 1 + Math.floor(rand(0, lastDay - 1));
      const cat = pick(EXPENSE_CATS);
      let amount: number;
      if (cat.name === 'Travel') amount = rand(2500, 18000);
      else if (cat.name === 'Bills & Utilities') amount = rand(800, 6500);
      else if (cat.name === 'Groceries') amount = rand(400, 4200);
      else if (cat.name === 'Shopping') amount = rand(600, 12000);
      else amount = rand(80, 2800);

      transactions.push(
        makeTxn(
          seq++,
          dateKey(year, month, day),
          'expense',
          cat.name,
          pick(ACCOUNTS).name,
          Math.round(amount),
          pick(EXPENSE_NOTES)
        )
      );
    }
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const currentMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const budgets: Budget[] = EXPENSE_CATS.slice(0, 5).map((c) => ({
    category: c.name,
    month: currentMonth,
    amount: Math.round(rand(4000, 15000)),
    currency: 'INR'
  }));

  return {
    version: LEDGER_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    transactions,
    accounts,
    categories,
    budgets,
    settings: { carryForward: false, showcaseMode: true }
  };
}

function makeTxn(
  seq: number,
  date: string,
  type: 'income' | 'expense',
  category: string,
  account: string,
  amount: number,
  note: string
): Transaction {
  const createdAt = `${date}T${pad2(8 + (seq % 12))}:${pad2(seq % 60)}:00.000Z`;
  return {
    id: `showcase-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    type,
    amount: Math.round(amount * 100) / 100,
    currency: 'INR',
    account,
    category,
    note,
    createdAt,
    createdBy: 'showcase',
    source: 'web',
    deleted: false
  };
}
