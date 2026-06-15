import type { Account, Budget, Category, Transaction, TransactionFormInput, TransactionType } from './finance';

export const LEDGER_STORAGE_VERSION = 2;
export const LOCAL_STORAGE_KEY = 'money-sheets-ledger-v1';

export type LedgerSettings = {
  /** Carry the running balance over from previous months. Disabled by default. */
  carryForward: boolean;
};

export const DEFAULT_SETTINGS: LedgerSettings = {
  carryForward: false
};

export type LedgerSnapshot = {
  version: number;
  updatedAt: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  settings: LedgerSettings;
};

export function createDefaultLedger(): LedgerSnapshot {
  const now = new Date().toISOString();
  return {
    version: LEDGER_STORAGE_VERSION,
    updatedAt: now,
    transactions: [],
    accounts: [
      { name: 'Cash', currency: 'INR', openingBalance: 0, active: true },
      { name: 'Bank', currency: 'INR', openingBalance: 0, active: true },
      { name: 'Savings', currency: 'INR', openingBalance: 0, active: true }
    ],
    categories: [
      { name: 'House Groceries', type: 'expense', active: true },
      { name: 'Food Outing', type: 'expense', active: true },
      { name: 'Transport & Fuel', type: 'expense', active: true },
      { name: 'Social Events', type: 'expense', active: true },
      { name: 'House Enhancement', type: 'expense', active: true },
      { name: 'Shopping', type: 'expense', active: true },
      { name: 'Doctor', type: 'expense', active: true },
      { name: 'Misc', type: 'expense', active: true },
      { name: 'Bills & Utilities', type: 'expense', active: true },
      { name: 'Education', type: 'expense', active: true },
      { name: 'Travelling', type: 'expense', active: true },
      { name: 'Salary', type: 'income', active: true },
      { name: 'Gift', type: 'income', active: true },
      { name: 'Other Income', type: 'income', active: true }
    ],
    budgets: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

export function newTransactionFromForm(
  form: TransactionFormInput,
  source: 'mobile' | 'web',
  createdBy = 'local-user'
): Transaction {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid amount greater than zero.');
  }

  const now = new Date();
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    date: form.date || now.toISOString().slice(0, 10),
    type: form.type,
    amount,
    currency: form.currency.trim() || 'INR',
    account: form.account.trim() || 'Cash',
    category: form.category.trim() || 'Other',
    note: form.note.trim(),
    createdAt: now.toISOString(),
    createdBy,
    source,
    deleted: false,
    receiptUrl: form.receiptUrl?.trim() || undefined
  };
}

export function ledgerFromImportedTransactions(transactions: Transaction[]): LedgerSnapshot {
  const base = createDefaultLedger();
  const accountNames = new Set<string>();
  const categoryMeta = new Map<string, TransactionType>();

  for (const transaction of transactions) {
    if (transaction.account) accountNames.add(transaction.account);
    if (transaction.category) categoryMeta.set(transaction.category, transaction.type);
  }

  const accounts: Account[] = [...accountNames].map((name) => {
    const currency = transactions.find((t) => t.account === name)?.currency ?? 'INR';
    return { name, currency, openingBalance: 0, active: true };
  });

  if (accounts.length === 0) {
    accounts.push(...base.accounts);
  }

  const categories: Category[] = [...categoryMeta.entries()].map(([name, type]) => ({
    name,
    type,
    active: true
  }));

  if (categories.length === 0) {
    categories.push(...base.categories);
  }

  return {
    version: LEDGER_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    transactions,
    accounts,
    categories,
    budgets: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

export function touchLedger(snapshot: LedgerSnapshot): LedgerSnapshot {
  return { ...snapshot, updatedAt: new Date().toISOString() };
}

export function appendTransactionToLedger(snapshot: LedgerSnapshot, transaction: Transaction): LedgerSnapshot {
  return touchLedger({ ...snapshot, transactions: [...snapshot.transactions, transaction] });
}

export function updateTransactionInLedger(snapshot: LedgerSnapshot, transaction: Transaction): LedgerSnapshot {
  return touchLedger({
    ...snapshot,
    transactions: snapshot.transactions.map((row) => (row.id === transaction.id ? transaction : row))
  });
}

export function softDeleteInLedger(snapshot: LedgerSnapshot, transaction: Transaction): LedgerSnapshot {
  const updated: Transaction = {
    ...transaction,
    deleted: true,
    updatedAt: new Date().toISOString()
  };
  return updateTransactionInLedger(snapshot, updated);
}

export function upsertBudgetInLedger(snapshot: LedgerSnapshot, budget: Budget): LedgerSnapshot {
  const budgets = snapshot.budgets.filter(
    (row) => !(row.category === budget.category && row.month === budget.month)
  );
  return touchLedger({ ...snapshot, budgets: [...budgets, budget] });
}

export function addAccountToLedger(snapshot: LedgerSnapshot, account: Account): LedgerSnapshot {
  const name = account.name.trim();
  if (!name) {
    throw new Error('Enter an account name.');
  }
  if (snapshot.accounts.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`An account named "${name}" already exists.`);
  }
  const next: Account = {
    name,
    currency: account.currency.trim() || 'INR',
    openingBalance: Number.isFinite(account.openingBalance) ? account.openingBalance : 0,
    active: true
  };
  return touchLedger({ ...snapshot, accounts: [...snapshot.accounts, next] });
}

export function removeAccountFromLedger(snapshot: LedgerSnapshot, name: string): LedgerSnapshot {
  return touchLedger({
    ...snapshot,
    accounts: snapshot.accounts.filter((row) => row.name !== name)
  });
}

export function addCategoryToLedger(snapshot: LedgerSnapshot, category: Category): LedgerSnapshot {
  const name = category.name.trim();
  if (!name) {
    throw new Error('Enter a category name.');
  }
  if (snapshot.categories.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A category named "${name}" already exists.`);
  }
  const next: Category = {
    name,
    type: category.type,
    active: true
  };
  return touchLedger({ ...snapshot, categories: [...snapshot.categories, next] });
}

export function removeCategoryFromLedger(snapshot: LedgerSnapshot, name: string): LedgerSnapshot {
  return touchLedger({
    ...snapshot,
    categories: snapshot.categories.filter((row) => row.name !== name)
  });
}

export function setCarryForwardInLedger(snapshot: LedgerSnapshot, carryForward: boolean): LedgerSnapshot {
  return touchLedger({
    ...snapshot,
    settings: { ...snapshot.settings, carryForward }
  });
}

export function parseStoredLedger(raw: string | null): LedgerSnapshot {
  if (!raw) return createDefaultLedger();
  try {
    const parsed = JSON.parse(raw) as LedgerSnapshot;
    if (!parsed || !Array.isArray(parsed.transactions)) return createDefaultLedger();
    return {
      version: parsed.version ?? LEDGER_STORAGE_VERSION,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      transactions: parsed.transactions ?? [],
      accounts: parsed.accounts?.length ? parsed.accounts : createDefaultLedger().accounts,
      categories: parsed.categories?.length ? parsed.categories : createDefaultLedger().categories,
      budgets: parsed.budgets ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    };
  } catch {
    return createDefaultLedger();
  }
}
