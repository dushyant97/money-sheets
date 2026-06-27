/** Account reads/writes against the normalized `accounts` table. */
import type { Account } from '../finance';
import type { SqlClient, SqlStatement } from './sqlClient';
import { ACCOUNT_COLUMNS, accountToArgs, rowToAccount } from './mappers';

const COLUMN_LIST = ACCOUNT_COLUMNS.join(', ');
const PLACEHOLDERS = ACCOUNT_COLUMNS.map(() => '?').join(', ');
const UPDATE_ASSIGNMENTS = ACCOUNT_COLUMNS.filter((c) => c !== 'name')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');

export const UPSERT_ACCOUNT_SQL =
  `INSERT INTO accounts (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ` +
  `ON CONFLICT(name) DO UPDATE SET ${UPDATE_ASSIGNMENTS};`;

export const DELETE_ACCOUNT_SQL = `DELETE FROM accounts WHERE name = ?;`;
export const SELECT_ALL_ACCOUNTS_SQL = `SELECT * FROM accounts ORDER BY rowid;`;

export function upsertAccountStatement(account: Account): SqlStatement {
  return { sql: UPSERT_ACCOUNT_SQL, args: accountToArgs(account) };
}

export async function saveAccount(client: SqlClient, account: Account): Promise<void> {
  await client.execute(upsertAccountStatement(account));
}

export async function removeAccount(client: SqlClient, name: string): Promise<void> {
  await client.execute({ sql: DELETE_ACCOUNT_SQL, args: [name] });
}

export async function loadAccounts(client: SqlClient): Promise<Account[]> {
  const result = await client.execute(SELECT_ALL_ACCOUNTS_SQL);
  return result.rows.map(rowToAccount);
}
