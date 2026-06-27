import { describe, expect, it } from 'vitest';
import type { Transaction } from './finance';
import {
  SHEET_ALL_TRANSACTIONS,
  SHEET_SUMMARY,
  buildMonthlySummary,
  buildTransactionsWorkbook,
  groupTransactionsByMonth
} from './spreadsheetExport';

function txn(partial: Partial<Transaction> & { id: string; date: string }): Transaction {
  return {
    type: 'expense',
    amount: 100,
    currency: 'INR',
    account: 'Cash',
    category: 'Misc',
    note: '',
    createdAt: `${partial.date}T00:00:00.000Z`,
    createdBy: 'test',
    source: 'web',
    deleted: false,
    ...partial
  } as Transaction;
}

describe('groupTransactionsByMonth', () => {
  it('groups by YYYY-MM and orders months chronologically', () => {
    const transactions = [
      txn({ id: '1', date: '2025-03-10' }),
      txn({ id: '2', date: '2025-01-05' }),
      txn({ id: '3', date: '2025-01-20' }),
      txn({ id: '4', date: '2025-02-14' })
    ];

    const grouped = groupTransactionsByMonth(transactions);

    expect([...grouped.keys()]).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(grouped.get('2025-01')!.map((t) => t.id)).toEqual(['2', '3']);
    expect(grouped.get('2025-02')!).toHaveLength(1);
  });

  it('keeps soft-deleted rows so monthly sheets mirror the master sheet', () => {
    const grouped = groupTransactionsByMonth([
      txn({ id: '1', date: '2025-01-05', deleted: true }),
      txn({ id: '2', date: '2025-01-06' })
    ]);
    expect(grouped.get('2025-01')!).toHaveLength(2);
  });

  it('returns an empty map for no transactions', () => {
    expect(groupTransactionsByMonth([]).size).toBe(0);
  });
});

describe('buildMonthlySummary', () => {
  it('computes income, expense, net and active count per month', () => {
    const summary = buildMonthlySummary([
      txn({ id: '1', date: '2025-01-05', type: 'income', amount: 1000 }),
      txn({ id: '2', date: '2025-01-10', type: 'expense', amount: 400 }),
      txn({ id: '3', date: '2025-01-12', type: 'expense', amount: 100, deleted: true })
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      month: '2025-01',
      income: 1000,
      expense: 400,
      net: 600,
      count: 2
    });
  });
});

describe('buildTransactionsWorkbook', () => {
  it('places All Transactions at index 0, months in the middle, Summary last', () => {
    const { sheets } = buildTransactionsWorkbook([
      txn({ id: '1', date: '2025-02-01' }),
      txn({ id: '2', date: '2025-01-01' })
    ]);

    const names = sheets.map((s) => s.name);
    expect(names[0]).toBe(SHEET_ALL_TRANSACTIONS);
    expect(names[names.length - 1]).toBe(SHEET_SUMMARY);
    expect(names).toEqual([SHEET_ALL_TRANSACTIONS, '2025-01', '2025-02', SHEET_SUMMARY]);
  });

  it('master sheet has a header row plus every transaction', () => {
    const { sheets } = buildTransactionsWorkbook([
      txn({ id: '1', date: '2025-01-01' }),
      txn({ id: '2', date: '2025-01-02' })
    ]);
    const master = sheets[0];
    // 1 header row + 2 data rows
    expect(master.rows).toHaveLength(3);
  });

  it('still emits master and summary sheets when there are no transactions', () => {
    const names = buildTransactionsWorkbook([]).sheets.map((s) => s.name);
    expect(names).toEqual([SHEET_ALL_TRANSACTIONS, SHEET_SUMMARY]);
  });
});
