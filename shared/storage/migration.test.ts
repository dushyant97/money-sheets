import { describe, expect, it } from 'vitest';
import { createDefaultLedger, type LedgerSnapshot } from '../ledgerStore';
import type { Transaction } from '../finance';
import type { SqlClient, SqlResultSet, SqlStatement } from './sqlClient';
import {
  SELECT_META_SQL,
  UPSERT_META_SQL,
  UPSERT_SNAPSHOT_BACKUP_SQL,
  META_SCHEMA_VERSION,
  NORMALIZED_SCHEMA_VERSION
} from './schema';
import { SELECT_SNAPSHOT_SQL } from './tursoSchema';
import { ensureMigrated, isMigrated } from './migration';

/** In-memory libSQL stand-in covering the statements migration issues. */
class MockClient implements SqlClient {
  meta = new Map<string, string>();
  backup: { json: string; at: string } | null = null;
  transactionUpserts = 0;
  batchCalls = 0;

  constructor(private legacySnapshot: string | null) {}

  async execute(statement: string | SqlStatement): Promise<SqlResultSet> {
    const stmt = typeof statement === 'string' ? { sql: statement, args: [] } : statement;
    const args = stmt.args ?? [];
    if (stmt.sql === SELECT_META_SQL) {
      const value = this.meta.get(String(args[0]));
      return { rows: value == null ? [] : [{ value }] };
    }
    if (stmt.sql === UPSERT_META_SQL) {
      this.meta.set(String(args[0]), String(args[1]));
      return { rows: [] };
    }
    if (stmt.sql === SELECT_SNAPSHOT_SQL) {
      return { rows: this.legacySnapshot == null ? [] : [{ snapshot_json: this.legacySnapshot }] };
    }
    if (stmt.sql === UPSERT_SNAPSHOT_BACKUP_SQL) {
      this.backup = { json: String(args[0]), at: String(args[1]) };
      return { rows: [] };
    }
    return { rows: [] };
  }

  async batch(statements: Array<string | SqlStatement>): Promise<SqlResultSet[]> {
    this.batchCalls += 1;
    for (const statement of statements) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.startsWith('INSERT INTO transactions')) this.transactionUpserts += 1;
    }
    return statements.map(() => ({ rows: [] }));
  }
}

function legacyLedgerJson(transactionCount: number): string {
  const base = createDefaultLedger();
  const transactions: Transaction[] = Array.from({ length: transactionCount }, (_, i) => ({
    id: `txn-${i}`,
    date: `2025-01-${String((i % 27) + 1).padStart(2, '0')}`,
    type: 'expense',
    amount: 10 + i,
    currency: 'INR',
    account: 'Cash',
    category: 'Misc',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    createdBy: 'local-user',
    source: 'web',
    deleted: false
  }));
  const ledger: LedgerSnapshot = { ...base, transactions };
  return JSON.stringify(ledger);
}

describe('ensureMigrated', () => {
  it('stamps the version on a fresh (empty) database without seeding rows', async () => {
    const client = new MockClient(null);
    await ensureMigrated(client);

    expect(await isMigrated(client)).toBe(true);
    expect(client.meta.get(META_SCHEMA_VERSION)).toBe(String(NORMALIZED_SCHEMA_VERSION));
    expect(client.backup).toBeNull();
    expect(client.transactionUpserts).toBe(0);
  });

  it('copies a legacy snapshot into normalized tables and backs it up', async () => {
    const client = new MockClient(legacyLedgerJson(3));
    await ensureMigrated(client);

    expect(await isMigrated(client)).toBe(true);
    expect(client.transactionUpserts).toBe(3);
    expect(client.backup?.json).toContain('"txn-0"');
  });

  it('is idempotent: a second call does nothing', async () => {
    const client = new MockClient(legacyLedgerJson(2));
    await ensureMigrated(client);
    const upsertsAfterFirst = client.transactionUpserts;
    const backupAfterFirst = client.backup;

    await ensureMigrated(client);

    expect(client.transactionUpserts).toBe(upsertsAfterFirst);
    expect(client.backup).toBe(backupAfterFirst);
  });

  it('skips migration when already stamped at v2', async () => {
    const client = new MockClient(legacyLedgerJson(5));
    client.meta.set(META_SCHEMA_VERSION, String(NORMALIZED_SCHEMA_VERSION));

    await ensureMigrated(client);

    expect(client.transactionUpserts).toBe(0);
    expect(client.backup).toBeNull();
  });
});
