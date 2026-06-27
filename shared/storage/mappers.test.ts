import { describe, expect, it } from 'vitest';
import type { Account, Budget, Category, Transaction } from '../finance';
import type { LedgerSettings } from '../ledgerStore';
import {
  TRANSACTION_COLUMNS,
  accountToArgs,
  budgetToArgs,
  categoryToArgs,
  entriesToSettings,
  monthOf,
  rowToAccount,
  rowToBudget,
  rowToCategory,
  rowToTransaction,
  settingsToEntries,
  transactionToArgs
} from './mappers';
import type { SqlRow, SqlValue } from './sqlClient';

/** Rebuild a row object from the column order + arg array, as a DB would. */
function argsToRow(columns: readonly string[], args: SqlValue[]): SqlRow {
  const row: SqlRow = {};
  columns.forEach((col, i) => {
    row[col] = args[i];
  });
  return row;
}

const baseTxn: Transaction = {
  id: 'txn-1',
  date: '2025-03-15',
  type: 'expense',
  amount: 250.5,
  currency: 'INR',
  account: 'Cash',
  category: 'Food Outing',
  note: 'lunch',
  createdAt: '2025-03-15T10:00:00.000Z',
  createdBy: 'local-user',
  source: 'web',
  deleted: false,
  updatedAt: undefined,
  receiptUrl: undefined
};

describe('monthOf', () => {
  it('derives YYYY-MM from an ISO date', () => {
    expect(monthOf('2025-03-15')).toBe('2025-03');
  });
});

describe('transaction mapper', () => {
  it('round-trips through args and row', () => {
    const row = argsToRow(TRANSACTION_COLUMNS, transactionToArgs(baseTxn));
    expect(rowToTransaction(row)).toEqual(baseTxn);
  });

  it('derives month and stores deleted as a bit', () => {
    const args = transactionToArgs({ ...baseTxn, deleted: true });
    expect(args[TRANSACTION_COLUMNS.indexOf('month')]).toBe('2025-03');
    expect(args[TRANSACTION_COLUMNS.indexOf('deleted')]).toBe(1);
  });

  it('maps optional fields to NULL and back to undefined', () => {
    const args = transactionToArgs(baseTxn);
    expect(args[TRANSACTION_COLUMNS.indexOf('receipt_url')]).toBeNull();
    expect(args[TRANSACTION_COLUMNS.indexOf('updated_at')]).toBeNull();

    const restored = rowToTransaction(argsToRow(TRANSACTION_COLUMNS, args));
    expect(restored.receiptUrl).toBeUndefined();
    expect(restored.updatedAt).toBeUndefined();
  });

  it('preserves populated optional fields', () => {
    const withExtras: Transaction = {
      ...baseTxn,
      updatedAt: '2025-03-16T00:00:00.000Z',
      receiptUrl: 'https://example.com/r.png'
    };
    const restored = rowToTransaction(argsToRow(TRANSACTION_COLUMNS, transactionToArgs(withExtras)));
    expect(restored.updatedAt).toBe(withExtras.updatedAt);
    expect(restored.receiptUrl).toBe(withExtras.receiptUrl);
  });
});

describe('account mapper', () => {
  it('round-trips and converts active to a bit', () => {
    const account: Account = {
      name: 'Bank',
      currency: 'INR',
      openingBalance: 1000,
      active: true,
      emoji: '🏦',
      color: '#4f7cff'
    };
    const columns = ['name', 'currency', 'opening_balance', 'active', 'emoji', 'color'];
    const restored = rowToAccount(argsToRow(columns, accountToArgs(account)));
    expect(restored).toEqual(account);
  });
});

describe('category mapper', () => {
  it('round-trips', () => {
    const category: Category = { name: 'Salary', type: 'income', active: true };
    const columns = ['name', 'type', 'active', 'emoji', 'color'];
    const restored = rowToCategory(argsToRow(columns, categoryToArgs(category)));
    expect(restored).toEqual({ ...category, emoji: undefined, color: undefined });
  });
});

describe('budget mapper', () => {
  it('round-trips', () => {
    const budget: Budget = { category: 'Food Outing', month: '2025-03', amount: 5000, currency: 'INR' };
    const columns = ['category', 'month', 'amount', 'currency'];
    expect(rowToBudget(argsToRow(columns, budgetToArgs(budget)))).toEqual(budget);
  });
});

describe('settings mapper', () => {
  it('serializes and restores carry-forward and showcase flags', () => {
    const settings: LedgerSettings = { carryForward: true, showcaseMode: false };
    const entries = new Map(settingsToEntries(settings));
    expect(entriesToSettings(entries)).toEqual(settings);
  });

  it('falls back to defaults when keys are missing', () => {
    expect(entriesToSettings(new Map())).toEqual({ carryForward: false });
  });
});
