import type { LedgerSnapshot } from '../ledgerStore';

/** Where the ledger is persisted. */
export type StorageMode = 'local' | 'turso';

/** Bring-your-own Turso (libSQL) credentials. Stored only on the user's device. */
export type TursoConfig = {
  /** e.g. `libsql://your-db-name.turso.io` (https:// is also accepted). */
  url: string;
  /** Database auth token. */
  authToken: string;
};

/** User's saved storage preference. Persisted in localStorage, never on Turso. */
export type StoragePreferences = {
  mode: StorageMode;
  turso: TursoConfig;
};

/**
 * The mode actually in effect right now, which can differ from the preferred
 * mode (e.g. Turso preferred but offline -> falls back to local).
 */
export type EffectiveStorageInfo = {
  /** What the user selected. */
  preferredMode: StorageMode;
  /** What is actually being read/written. */
  effectiveMode: StorageMode;
  /** True when Turso is preferred but unavailable and we fell back to local. */
  isTursoFallback: boolean;
  /** Browser connectivity at resolve time. */
  isOnline: boolean;
};

/**
 * Contract every storage adapter implements. Web has localStorage + Turso
 * implementations; mobile can add AsyncStorage + Turso later using the same
 * shape.
 */
export type LedgerStorageAdapter = {
  load(): Promise<LedgerSnapshot>;
  save(snapshot: LedgerSnapshot): Promise<void>;
  clear(): Promise<LedgerSnapshot>;
};

export const DEFAULT_STORAGE_PREFERENCES: StoragePreferences = {
  mode: 'local',
  turso: { url: '', authToken: '' }
};
