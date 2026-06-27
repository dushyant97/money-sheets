/**
 * Normalized Turso (libSQL) schema (v2). Replaces the single-blob
 * `ledger_snapshot` model with real tables so writes touch one row and reads
 * can be scoped by month. Only SQL strings live here — no client import — so
 * the module is safe to share and unit test.
 *
 * The legacy `ledger_snapshot` table (see `tursoSchema.ts`) is still created
 * and read for migration/offline-compatibility; it is never the source of
 * truth once migration to v2 completes.
 */

export const NORMALIZED_SCHEMA_VERSION = 2;

/** Keys stored in the `schema_meta` table. */
export const META_SCHEMA_VERSION = 'schema_version';
export const META_SNAPSHOT_MIGRATED_AT = 'snapshot_migrated_at';

/** Keys stored in the `settings` table. */
export const SETTING_CARRY_FORWARD = 'carry_forward';
export const SETTING_SHOWCASE_MODE = 'showcase_mode';
export const SETTING_LEDGER_UPDATED_AT = 'ledger_updated_at';

const CREATE_SCHEMA_META = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`.trim();

const CREATE_TRANSACTIONS = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  month TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  account TEXT NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  receipt_url TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('mobile','web'))
);
`.trim();

const CREATE_TRANSACTION_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_txn_month ON transactions(month) WHERE deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_txn_category_month ON transactions(category, month) WHERE deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_txn_account_month ON transactions(account, month) WHERE deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);`,
  `CREATE INDEX IF NOT EXISTS idx_txn_deleted ON transactions(deleted);`
];

const CREATE_ACCOUNTS = `
CREATE TABLE IF NOT EXISTS accounts (
  name TEXT PRIMARY KEY,
  currency TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  emoji TEXT,
  color TEXT
);
`.trim();

const CREATE_CATEGORIES = `
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  active INTEGER NOT NULL DEFAULT 1,
  emoji TEXT,
  color TEXT
);
`.trim();

const CREATE_BUDGETS = `
CREATE TABLE IF NOT EXISTS budgets (
  category TEXT NOT NULL,
  month TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  PRIMARY KEY (category, month)
);
`.trim();

const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`.trim();

const CREATE_SNAPSHOT_BACKUP = `
CREATE TABLE IF NOT EXISTS ledger_snapshot_backup (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot_json TEXT NOT NULL,
  migrated_at TEXT NOT NULL
);
`.trim();

/**
 * All statements required to bring a database up to the v2 schema. Safe to run
 * repeatedly (every statement is `IF NOT EXISTS`).
 */
export const CREATE_V2_TABLES_SQL: string[] = [
  CREATE_SCHEMA_META,
  CREATE_TRANSACTIONS,
  ...CREATE_TRANSACTION_INDEXES,
  CREATE_ACCOUNTS,
  CREATE_CATEGORIES,
  CREATE_BUDGETS,
  CREATE_SETTINGS,
  CREATE_SNAPSHOT_BACKUP
];

// ── schema_meta helpers ──────────────────────────────────────────────────────
export const SELECT_META_SQL = `SELECT value FROM schema_meta WHERE key = ?;`;
export const UPSERT_META_SQL = `
INSERT INTO schema_meta (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`.trim();

// ── settings helpers ─────────────────────────────────────────────────────────
export const SELECT_ALL_SETTINGS_SQL = `SELECT key, value FROM settings;`;
export const UPSERT_SETTING_SQL = `
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`.trim();

// ── snapshot backup ──────────────────────────────────────────────────────────
export const SELECT_SNAPSHOT_BACKUP_SQL = `SELECT snapshot_json FROM ledger_snapshot_backup WHERE id = 1;`;
export const UPSERT_SNAPSHOT_BACKUP_SQL = `
INSERT INTO ledger_snapshot_backup (id, snapshot_json, migrated_at) VALUES (1, ?, ?)
ON CONFLICT(id) DO UPDATE SET snapshot_json = excluded.snapshot_json, migrated_at = excluded.migrated_at;
`.trim();
