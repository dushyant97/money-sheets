/** Category reads/writes against the normalized `categories` table. */
import type { Category } from '../finance';
import type { SqlClient, SqlStatement } from './sqlClient';
import { CATEGORY_COLUMNS, categoryToArgs, rowToCategory } from './mappers';

const COLUMN_LIST = CATEGORY_COLUMNS.join(', ');
const PLACEHOLDERS = CATEGORY_COLUMNS.map(() => '?').join(', ');
const UPDATE_ASSIGNMENTS = CATEGORY_COLUMNS.filter((c) => c !== 'name')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');

export const UPSERT_CATEGORY_SQL =
  `INSERT INTO categories (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ` +
  `ON CONFLICT(name) DO UPDATE SET ${UPDATE_ASSIGNMENTS};`;

export const DELETE_CATEGORY_SQL = `DELETE FROM categories WHERE name = ?;`;
export const SELECT_ALL_CATEGORIES_SQL = `SELECT * FROM categories ORDER BY rowid;`;

export function upsertCategoryStatement(category: Category): SqlStatement {
  return { sql: UPSERT_CATEGORY_SQL, args: categoryToArgs(category) };
}

export async function saveCategory(client: SqlClient, category: Category): Promise<void> {
  await client.execute(upsertCategoryStatement(category));
}

export async function removeCategory(client: SqlClient, name: string): Promise<void> {
  await client.execute({ sql: DELETE_CATEGORY_SQL, args: [name] });
}

export async function loadCategories(client: SqlClient): Promise<Category[]> {
  const result = await client.execute(SELECT_ALL_CATEGORIES_SQL);
  return result.rows.map(rowToCategory);
}
