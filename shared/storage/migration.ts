/**
 * One-time, idempotent migration from the legacy single-blob `ledger_snapshot`
 * table to the normalized v2 schema. Safe to call on every Turso connect:
 *
 *  - Already v2 → returns immediately.
 *  - Empty database → just stamps the schema version (no rows seeded; the
 *    repository returns defaults for an empty DB).
 *  - Legacy snapshot present → copies it into the normalized tables, backs up
 *    the original blob, then stamps the version LAST. Because every write is an
 *    idempotent upsert keyed by primary key, an interrupted migration simply
 *    re-runs on the next connect without duplicating data.
 */
import { parseStoredLedger } from '../ledgerStore';
import type { SqlClient } from './sqlClient';
import { CREATE_LEDGER_TABLE_SQL, SELECT_SNAPSHOT_SQL } from './tursoSchema';
import {
  CREATE_V2_TABLES_SQL,
  META_SCHEMA_VERSION,
  META_SNAPSHOT_MIGRATED_AT,
  NORMALIZED_SCHEMA_VERSION,
  SELECT_META_SQL,
  UPSERT_META_SQL,
  UPSERT_SNAPSHOT_BACKUP_SQL
} from './schema';
import { writeSnapshot } from './snapshotWrite';

/** Create the v2 tables (and the legacy table, for migration reads). */
export async function ensureNormalizedSchema(client: SqlClient): Promise<void> {
  await client.batch([...CREATE_V2_TABLES_SQL, CREATE_LEDGER_TABLE_SQL], 'write');
}

export async function getMeta(client: SqlClient, key: string): Promise<string | null> {
  const result = await client.execute({ sql: SELECT_META_SQL, args: [key] });
  const value = result.rows[0]?.value;
  return value == null ? null : String(value);
}

export async function setMeta(client: SqlClient, key: string, value: string): Promise<void> {
  await client.execute({ sql: UPSERT_META_SQL, args: [key, value] });
}

async function readLegacySnapshotJson(client: SqlClient): Promise<string | null> {
  const result = await client.execute(SELECT_SNAPSHOT_SQL);
  const raw = result.rows[0]?.snapshot_json;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/** True once the database has been stamped at the current schema version. */
export async function isMigrated(client: SqlClient): Promise<boolean> {
  return (await getMeta(client, META_SCHEMA_VERSION)) === String(NORMALIZED_SCHEMA_VERSION);
}

export async function ensureMigrated(client: SqlClient): Promise<void> {
  await ensureNormalizedSchema(client);
  if (await isMigrated(client)) return;

  const raw = await readLegacySnapshotJson(client);
  if (!raw) {
    // Fresh database: nothing to copy. Stamp the version so we never re-check.
    await setMeta(client, META_SCHEMA_VERSION, String(NORMALIZED_SCHEMA_VERSION));
    return;
  }

  const ledger = parseStoredLedger(raw);
  await writeSnapshot(client, ledger, { replace: false });
  await client.execute({ sql: UPSERT_SNAPSHOT_BACKUP_SQL, args: [raw, new Date().toISOString()] });
  await setMeta(client, META_SNAPSHOT_MIGRATED_AT, new Date().toISOString());
  // Stamp the version LAST so an interrupted run re-migrates idempotently.
  await setMeta(client, META_SCHEMA_VERSION, String(NORMALIZED_SCHEMA_VERSION));
}
