import { type LedgerSnapshot, createDefaultLedger, parseStoredLedger } from '../../../shared/ledgerStore';
import type { LedgerStorageAdapter, TursoConfig } from '../../../shared/storage/types';
import {
  CREATE_LEDGER_TABLE_SQL,
  DELETE_SNAPSHOT_SQL,
  PING_SQL,
  SELECT_SNAPSHOT_SQL,
  UPSERT_SNAPSHOT_SQL
} from '../../../shared/storage/tursoSchema';

// On React Native the default `@libsql/client` entry uses the HTTP driver over
// the global `fetch`, which works without Node built-ins. Lazy-import on first
// Turso use so offline-only installs never pay the bundle cost.
type LibsqlClient = import('@libsql/client').Client;
const loadLibsql = () => import('@libsql/client');

async function createClient(config: TursoConfig): Promise<LibsqlClient> {
  const { createClient: create } = await loadLibsql();
  return create({ url: config.url.trim(), authToken: config.authToken.trim() });
}

async function ensureSchema(client: LibsqlClient): Promise<void> {
  await client.execute(CREATE_LEDGER_TABLE_SQL);
}

/**
 * Verify the credentials work and the schema exists. Throws with a readable
 * message on failure. Used by the "Test connection" button (does not persist).
 */
export async function testTursoConnection(config: TursoConfig): Promise<void> {
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    await client.execute(PING_SQL);
    await ensureSchema(client);
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
}

export async function loadTursoLedger(config: TursoConfig): Promise<LedgerSnapshot> {
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    await ensureSchema(client);
    const result = await client.execute(SELECT_SNAPSHOT_SQL);
    const raw = result.rows[0]?.snapshot_json;
    return parseStoredLedger(typeof raw === 'string' ? raw : null);
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
}

export async function saveTursoLedger(config: TursoConfig, snapshot: LedgerSnapshot): Promise<void> {
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    await ensureSchema(client);
    await client.execute({
      sql: UPSERT_SNAPSHOT_SQL,
      args: [JSON.stringify(snapshot), snapshot.updatedAt ?? new Date().toISOString()]
    });
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
}

export async function clearTursoLedger(config: TursoConfig): Promise<LedgerSnapshot> {
  const fresh = createDefaultLedger();
  let client: LibsqlClient | null = null;
  try {
    client = await createClient(config);
    await ensureSchema(client);
    await client.execute(DELETE_SNAPSHOT_SQL);
    await client.execute({
      sql: UPSERT_SNAPSHOT_SQL,
      args: [JSON.stringify(fresh), fresh.updatedAt]
    });
  } catch (error) {
    throw new Error(tursoErrorMessage(error));
  } finally {
    client?.close();
  }
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
