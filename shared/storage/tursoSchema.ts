/**
 * Turso (libSQL) schema for the simple single-snapshot storage model.
 *
 * The entire ledger is stored as one JSON blob in a single row (id = 1),
 * mirroring the local-storage model. This keeps reads/writes trivial and the
 * data shape identical across storage backends.
 *
 * No libSQL client is imported here — only SQL strings — so this module is
 * safe to share with any platform.
 */

export const TURSO_SCHEMA_VERSION = 1;

/** Fixed primary key for the one-and-only snapshot row. */
export const SNAPSHOT_ROW_ID = 1;

export const CREATE_LEDGER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ledger_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`.trim();

export const SELECT_SNAPSHOT_SQL = `SELECT snapshot_json FROM ledger_snapshot WHERE id = ${SNAPSHOT_ROW_ID};`;

export const UPSERT_SNAPSHOT_SQL = `
INSERT INTO ledger_snapshot (id, snapshot_json, updated_at)
VALUES (${SNAPSHOT_ROW_ID}, ?, ?)
ON CONFLICT(id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at;
`.trim();

export const DELETE_SNAPSHOT_SQL = `DELETE FROM ledger_snapshot WHERE id = ${SNAPSHOT_ROW_ID};`;

/** Lightweight connectivity probe used by "Test connection". */
export const PING_SQL = 'SELECT 1;';
