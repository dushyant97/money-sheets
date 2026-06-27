/**
 * Transaction reads/writes against the normalized `transactions` table.
 * Each mutation touches a single row (no full-ledger rewrite).
 */
import type { Transaction } from '../finance';
import type { SqlClient, SqlStatement } from './sqlClient';
import { TRANSACTION_COLUMNS, rowToTransaction, transactionToArgs } from './mappers';

const COLUMN_LIST = TRANSACTION_COLUMNS.join(', ');
const PLACEHOLDERS = TRANSACTION_COLUMNS.map(() => '?').join(', ');
const UPDATE_ASSIGNMENTS = TRANSACTION_COLUMNS.filter((c) => c !== 'id')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');

export const UPSERT_TRANSACTION_SQL =
  `INSERT INTO transactions (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ` +
  `ON CONFLICT(id) DO UPDATE SET ${UPDATE_ASSIGNMENTS};`;

export const SOFT_DELETE_TRANSACTION_SQL = `UPDATE transactions SET deleted = 1, updated_at = ? WHERE id = ?;`;

/** All rows (including soft-deleted) for assembling the full snapshot. */
export const SELECT_ALL_TRANSACTIONS_SQL = `SELECT * FROM transactions ORDER BY date ASC, created_at ASC;`;

/** Active rows for one month (Records page, phase 2 scoped read). */
export const SELECT_TRANSACTIONS_BY_MONTH_SQL =
  `SELECT * FROM transactions WHERE month = ? AND deleted = 0 ORDER BY date DESC, created_at DESC;`;

export function upsertTransactionStatement(transaction: Transaction): SqlStatement {
  return { sql: UPSERT_TRANSACTION_SQL, args: transactionToArgs(transaction) };
}

export async function insertTransaction(client: SqlClient, transaction: Transaction): Promise<void> {
  await client.execute(upsertTransactionStatement(transaction));
}

export async function updateTransaction(client: SqlClient, transaction: Transaction): Promise<void> {
  await client.execute(upsertTransactionStatement(transaction));
}

export async function softDeleteTransaction(client: SqlClient, id: string): Promise<void> {
  await client.execute({ sql: SOFT_DELETE_TRANSACTION_SQL, args: [new Date().toISOString(), id] });
}

/**
 * Load transactions. With no `month`, returns every row (including deleted) for
 * full-snapshot assembly. With a `month`, returns only that month's active rows.
 */
export async function loadTransactions(client: SqlClient, month?: string): Promise<Transaction[]> {
  const statement: string | SqlStatement = month
    ? { sql: SELECT_TRANSACTIONS_BY_MONTH_SQL, args: [month] }
    : SELECT_ALL_TRANSACTIONS_SQL;
  const result = await client.execute(statement);
  return result.rows.map(rowToTransaction);
}
