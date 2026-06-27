/** Budget reads/writes against the normalized `budgets` table. */
import type { Budget } from '../finance';
import type { SqlClient, SqlStatement } from './sqlClient';
import { BUDGET_COLUMNS, budgetToArgs, rowToBudget } from './mappers';

const COLUMN_LIST = BUDGET_COLUMNS.join(', ');
const PLACEHOLDERS = BUDGET_COLUMNS.map(() => '?').join(', ');

export const UPSERT_BUDGET_SQL =
  `INSERT INTO budgets (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ` +
  `ON CONFLICT(category, month) DO UPDATE SET amount = excluded.amount, currency = excluded.currency;`;

export const DELETE_BUDGET_SQL = `DELETE FROM budgets WHERE category = ? AND month = ?;`;
export const SELECT_ALL_BUDGETS_SQL = `SELECT * FROM budgets ORDER BY month, category;`;
export const SELECT_BUDGETS_BY_MONTH_SQL = `SELECT * FROM budgets WHERE month = ? ORDER BY category;`;

export function upsertBudgetStatement(budget: Budget): SqlStatement {
  return { sql: UPSERT_BUDGET_SQL, args: budgetToArgs(budget) };
}

export async function upsertBudget(client: SqlClient, budget: Budget): Promise<void> {
  await client.execute(upsertBudgetStatement(budget));
}

export async function removeBudget(client: SqlClient, category: string, month: string): Promise<void> {
  await client.execute({ sql: DELETE_BUDGET_SQL, args: [category, month] });
}

export async function loadBudgets(client: SqlClient, month?: string): Promise<Budget[]> {
  const statement: string | SqlStatement = month
    ? { sql: SELECT_BUDGETS_BY_MONTH_SQL, args: [month] }
    : SELECT_ALL_BUDGETS_SQL;
  const result = await client.execute(statement);
  return result.rows.map(rowToBudget);
}
