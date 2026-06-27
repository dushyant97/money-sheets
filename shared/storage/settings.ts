/**
 * Settings reads/writes against the normalized `settings` key/value table.
 * Also owns the `ledger_updated_at` marker used for sync/conflict detection.
 */
import type { LedgerSettings } from '../ledgerStore';
import type { SqlClient, SqlStatement } from './sqlClient';
import {
  SELECT_ALL_SETTINGS_SQL,
  SETTING_LEDGER_UPDATED_AT,
  UPSERT_SETTING_SQL
} from './schema';
import { entriesToSettings, settingsToEntries } from './mappers';

function upsertSettingStatement(key: string, value: string): SqlStatement {
  return { sql: UPSERT_SETTING_SQL, args: [key, value] };
}

async function readAllSettings(client: SqlClient): Promise<Map<string, string>> {
  const result = await client.execute(SELECT_ALL_SETTINGS_SQL);
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(String(row.key), String(row.value));
  }
  return map;
}

export async function loadSettings(client: SqlClient): Promise<LedgerSettings> {
  return entriesToSettings(await readAllSettings(client));
}

export async function saveSettings(client: SqlClient, settings: LedgerSettings): Promise<void> {
  const statements = settingsToEntries(settings).map(([key, value]) => upsertSettingStatement(key, value));
  await client.batch(statements, 'write');
}

/** Statements to persist settings, for inclusion in a larger batch. */
export function settingsStatements(settings: LedgerSettings): SqlStatement[] {
  return settingsToEntries(settings).map(([key, value]) => upsertSettingStatement(key, value));
}

export async function setLedgerUpdatedAt(client: SqlClient, updatedAt: string): Promise<void> {
  await client.execute(upsertSettingStatement(SETTING_LEDGER_UPDATED_AT, updatedAt));
}

export function ledgerUpdatedAtStatement(updatedAt: string): SqlStatement {
  return upsertSettingStatement(SETTING_LEDGER_UPDATED_AT, updatedAt);
}

export async function getLedgerUpdatedAt(client: SqlClient): Promise<string | null> {
  const map = await readAllSettings(client);
  return map.get(SETTING_LEDGER_UPDATED_AT) ?? null;
}
