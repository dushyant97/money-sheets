/**
 * Pure converters between domain objects and normalized SQL rows/argument
 * arrays. No client import, so these are unit tested directly.
 *
 * Conventions:
 *  - `month` is always derived from `date` (`YYYY-MM`), never trusted from input.
 *  - SQLite has no boolean: `deleted`/`active` are stored as 0/1.
 *  - Optional strings (`updatedAt`, `receiptUrl`, `emoji`, `color`) map to NULL.
 */
import type { Account, Budget, Category, Transaction, TransactionType } from '../finance';
import type { LedgerSettings } from '../ledgerStore';
import { DEFAULT_SETTINGS } from '../ledgerStore';
import type { SqlRow, SqlValue } from './sqlClient';
import { SETTING_CARRY_FORWARD, SETTING_SHOWCASE_MODE } from './schema';

const toBit = (value: boolean | undefined): number => (value ? 1 : 0);
const fromBit = (value: unknown): boolean => Number(value) === 1;
const optionalText = (value: string | undefined): SqlValue => (value && value.trim() ? value : null);
const readString = (value: unknown): string => (value == null ? '' : String(value));
const readOptional = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  const text = String(value);
  return text.length ? text : undefined;
};

export const monthOf = (date: string): string => date.slice(0, 7);

// ── transactions ─────────────────────────────────────────────────────────────
/** Column order for the transactions table (insert/upsert binding order). */
export const TRANSACTION_COLUMNS = [
  'id',
  'date',
  'month',
  'type',
  'amount',
  'currency',
  'account',
  'category',
  'note',
  'receipt_url',
  'created_at',
  'created_by',
  'updated_at',
  'deleted',
  'source'
] as const;

export function transactionToArgs(transaction: Transaction): SqlValue[] {
  return [
    transaction.id,
    transaction.date,
    monthOf(transaction.date),
    transaction.type,
    transaction.amount,
    transaction.currency,
    transaction.account,
    transaction.category,
    transaction.note ?? '',
    optionalText(transaction.receiptUrl),
    transaction.createdAt,
    transaction.createdBy,
    optionalText(transaction.updatedAt),
    toBit(transaction.deleted),
    transaction.source
  ];
}

export function rowToTransaction(row: SqlRow): Transaction {
  return {
    id: readString(row.id),
    date: readString(row.date),
    type: readString(row.type) as TransactionType,
    amount: Number(row.amount),
    currency: readString(row.currency),
    account: readString(row.account),
    category: readString(row.category),
    note: readString(row.note),
    createdAt: readString(row.created_at),
    createdBy: readString(row.created_by),
    source: readString(row.source) as Transaction['source'],
    deleted: fromBit(row.deleted),
    updatedAt: readOptional(row.updated_at),
    receiptUrl: readOptional(row.receipt_url)
  };
}

// ── accounts ─────────────────────────────────────────────────────────────────
export const ACCOUNT_COLUMNS = ['name', 'currency', 'opening_balance', 'active', 'emoji', 'color'] as const;

export function accountToArgs(account: Account): SqlValue[] {
  return [
    account.name,
    account.currency,
    Number.isFinite(account.openingBalance) ? account.openingBalance : 0,
    toBit(account.active),
    optionalText(account.emoji),
    optionalText(account.color)
  ];
}

export function rowToAccount(row: SqlRow): Account {
  return {
    name: readString(row.name),
    currency: readString(row.currency),
    openingBalance: Number(row.opening_balance),
    active: fromBit(row.active),
    emoji: readOptional(row.emoji),
    color: readOptional(row.color)
  };
}

// ── categories ───────────────────────────────────────────────────────────────
export const CATEGORY_COLUMNS = ['name', 'type', 'active', 'emoji', 'color'] as const;

export function categoryToArgs(category: Category): SqlValue[] {
  return [
    category.name,
    category.type,
    toBit(category.active),
    optionalText(category.emoji),
    optionalText(category.color)
  ];
}

export function rowToCategory(row: SqlRow): Category {
  return {
    name: readString(row.name),
    type: readString(row.type) as TransactionType,
    active: fromBit(row.active),
    emoji: readOptional(row.emoji),
    color: readOptional(row.color)
  };
}

// ── budgets ──────────────────────────────────────────────────────────────────
export const BUDGET_COLUMNS = ['category', 'month', 'amount', 'currency'] as const;

export function budgetToArgs(budget: Budget): SqlValue[] {
  return [budget.category, budget.month, budget.amount, budget.currency];
}

export function rowToBudget(row: SqlRow): Budget {
  return {
    category: readString(row.category),
    month: readString(row.month),
    amount: Number(row.amount),
    currency: readString(row.currency)
  };
}

// ── settings ─────────────────────────────────────────────────────────────────
/** Map the ledger settings to `settings` key/value pairs (excludes metadata). */
export function settingsToEntries(settings: LedgerSettings): Array<[string, string]> {
  return [
    [SETTING_CARRY_FORWARD, settings.carryForward ? 'true' : 'false'],
    [SETTING_SHOWCASE_MODE, settings.showcaseMode ? 'true' : 'false']
  ];
}

/** Rebuild ledger settings from the `settings` key/value rows. */
export function entriesToSettings(entries: Map<string, string>): LedgerSettings {
  const settings: LedgerSettings = { ...DEFAULT_SETTINGS };
  if (entries.has(SETTING_CARRY_FORWARD)) {
    settings.carryForward = entries.get(SETTING_CARRY_FORWARD) === 'true';
  }
  if (entries.has(SETTING_SHOWCASE_MODE)) {
    settings.showcaseMode = entries.get(SETTING_SHOWCASE_MODE) === 'true';
  }
  return settings;
}
