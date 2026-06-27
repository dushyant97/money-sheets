import type { Account, Budget, Category, Transaction } from '../finance';
import type { LedgerSettings, LedgerSnapshot } from '../ledgerStore';

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

/**
 * Granular storage contract backing the normalized Turso repository (phase 1).
 * The local adapter satisfies the snapshot-level methods via `load`/`save`; the
 * Turso repository additionally supports the per-entity methods so a single
 * mutation no longer rewrites the whole ledger. `month` filters are wired into
 * the UI in a later phase (Records/Stats scoped reads).
 */
export interface TransactionStore {
  loadTransactions(month?: string): Promise<Transaction[]>;
  insertTransaction(transaction: Transaction): Promise<void>;
  updateTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
}

export interface AccountStore {
  loadAccounts(): Promise<Account[]>;
  saveAccount(account: Account): Promise<void>;
  removeAccount(name: string): Promise<void>;
}

export interface CategoryStore {
  loadCategories(): Promise<Category[]>;
  saveCategory(category: Category): Promise<void>;
  removeCategory(name: string): Promise<void>;
}

export interface BudgetStore {
  loadBudgets(month?: string): Promise<Budget[]>;
  upsertBudget(budget: Budget): Promise<void>;
}

export interface SettingsStore {
  loadSettings(): Promise<LedgerSettings>;
  saveSettings(settings: LedgerSettings): Promise<void>;
}

export interface LedgerRepository
  extends TransactionStore,
    AccountStore,
    CategoryStore,
    BudgetStore,
    SettingsStore {
  /** Assemble the full snapshot for the UI and the local cache. */
  loadSnapshot(): Promise<LedgerSnapshot>;
  /** Bump the `ledger_updated_at` marker used for sync comparison. */
  touchLedger(): Promise<void>;
  clear(): Promise<LedgerSnapshot>;
}
