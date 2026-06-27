import { type LedgerSnapshot, createDefaultLedger } from '../../../shared/ledgerStore';
import type { LedgerStorageAdapter, TursoConfig } from '../../../shared/storage/types';
import type { SqlClient } from '../../../shared/storage/sqlClient';
import { PING_SQL } from '../../../shared/storage/tursoSchema';
import { ensureMigrated, ensureNormalizedSchema } from '../../../shared/storage/migration';
import {
  applyChange,
  getLedgerUpdatedAt,
  loadSnapshot,
  saveSnapshot,
  type LedgerChange
} from '../../../shared/storage/repository';

export type { LedgerChange } from '../../../shared/storage/repository';

// The libSQL web client pulls in a non-trivial amount of code, so load it on
// demand the first time Turso is actually used. Offline-only users never pay
// the bundle cost.
type LibsqlClient = import('@libsql/client/web').Client;
const loadLibsql = () => import('@libsql/client/web');

async function createClient(config: TursoConfig): Promise<LibsqlClient> {
  const { createClient: create } = await loadLibsql();
  return create({ url: config.url.trim(), authToken: config.authToken.trim() });
}

/**
 * Run `fn` against a connected client, migrating to the normalized v2 schema
 * first. The migration is idempotent and a no-op once stamped, so it is safe to
 * run on every operation. Errors are wrapped with a readable message.
 */
async function withMigratedClient<T>(
  config: TursoConfig,
  fn: (client: SqlClient) => Promise<T>
): Promise<T> {
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    const sqlClient = client as unknown as SqlClient;
    await ensureMigrated(sqlClient);
    return await fn(sqlClient);
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
}

/**
 * Verify the credentials work and the schema exists. Throws with a readable
 * message on failure. Used by the "Test connection" button — only ensures the
 * tables exist (no data migration) so it stays fast and side-effect free.
 */
export async function testTursoConnection(config: TursoConfig): Promise<void> {
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    await client.execute(PING_SQL);
    await ensureNormalizedSchema(client as unknown as SqlClient);
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
}

/** Assemble the full ledger from the normalized tables. */
export async function loadTursoLedger(config: TursoConfig): Promise<LedgerSnapshot> {
  return withMigratedClient(config, (client) => loadSnapshot(client));
}

/** Overwrite the entire Turso store with a snapshot (import/seed/switch). */
export async function saveTursoLedger(config: TursoConfig, snapshot: LedgerSnapshot): Promise<void> {
  await withMigratedClient(config, (client) => saveSnapshot(client, snapshot));
}

/**
 * Apply one granular mutation to Turso (single-row write) and bump the sync
 * marker. Falls back to a full rewrite when no change descriptor is supplied.
 */
export async function applyTursoChange(
  config: TursoConfig,
  snapshot: LedgerSnapshot,
  change?: LedgerChange
): Promise<void> {
  await withMigratedClient(config, (client) => applyChange(client, snapshot, change));
}

/** The `ledger_updated_at` marker, for sync/conflict comparison. */
export async function loadTursoUpdatedAt(config: TursoConfig): Promise<string | null> {
  return withMigratedClient(config, (client) => getLedgerUpdatedAt(client));
}

export async function clearTursoLedger(config: TursoConfig): Promise<LedgerSnapshot> {
  const fresh = createDefaultLedger();
  await withMigratedClient(config, (client) => saveSnapshot(client, fresh));
  return fresh;
}

function tursoErrorMessage(error: unknown): string {
  const base = error instanceof Error ? error.message : String(error);
  return `Turso error: ${base}`;
}

/** Build an adapter bound to a specific Turso config. */
export function createTursoAdapter(config: TursoConfig): LedgerStorageAdapter {
  return {
    load: () => loadTursoLedger(config),
    save: (snapshot) => saveTursoLedger(config, snapshot),
    clear: () => clearTursoLedger(config)
  };
}
