/**
 * Bulk-write a whole `LedgerSnapshot` into the normalized tables.
 *
 * Used by migration (one-time copy from the legacy blob), the storage switch /
 * Case-4 "use this device" seed, and the Excel→Turso import. All writes are
 * idempotent upserts keyed by primary key, so re-running after an interruption
 * is safe. Statements are chunked (~150 per batch) to stay within libSQL batch
 * limits on large ledgers.
 */
import type { LedgerSnapshot } from '../ledgerStore';
import type { SqlClient, SqlStatement } from './sqlClient';
import { upsertTransactionStatement } from './transactions';
import { upsertAccountStatement } from './accounts';
import { upsertCategoryStatement } from './categories';
import { upsertBudgetStatement } from './budgets';
import { ledgerUpdatedAtStatement, settingsStatements } from './settings';

const BATCH_CHUNK_SIZE = 150;

const DELETE_ALL_SQL: string[] = [
  'DELETE FROM transactions;',
  'DELETE FROM accounts;',
  'DELETE FROM categories;',
  'DELETE FROM budgets;'
];

/** Upsert statements that reproduce the snapshot in the normalized tables. */
export function snapshotUpsertStatements(snapshot: LedgerSnapshot): SqlStatement[] {
  return [
    ...snapshot.accounts.map(upsertAccountStatement),
    ...snapshot.categories.map(upsertCategoryStatement),
    ...snapshot.budgets.map(upsertBudgetStatement),
    ...snapshot.transactions.map(upsertTransactionStatement),
    ...settingsStatements(snapshot.settings),
    ledgerUpdatedAtStatement(snapshot.updatedAt)
  ];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runBatched(client: SqlClient, statements: Array<string | SqlStatement>): Promise<void> {
  for (const group of chunk(statements, BATCH_CHUNK_SIZE)) {
    if (group.length) await client.batch(group, 'write');
  }
}

/**
 * Write the snapshot to the normalized tables.
 *
 * `replace` clears the existing rows first (used when overwriting Turso with a
 * different source of truth). Without it, existing rows are merged via upsert
 * (used by migration into empty tables).
 */
export async function writeSnapshot(
  client: SqlClient,
  snapshot: LedgerSnapshot,
  options: { replace?: boolean } = {}
): Promise<void> {
  if (options.replace) {
    await client.batch(DELETE_ALL_SQL, 'write');
  }
  await runBatched(client, snapshotUpsertStatements(snapshot));
}
