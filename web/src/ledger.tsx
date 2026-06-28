import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Account, Budget, Category, Transaction, TransactionFormInput } from '../../shared/finance';
import {
  TransactionFilters,
  budgetProgressForMonth,
  buildCalendarMonth,
  buildCategoryTrends,
  carryOverBalance,
  computeAccountBalances,
  filterTransactions,
  monthKey,
  summarizeByCategory,
  summarizeMonth,
  summarizeWeek,
  transactionsInMonth
} from '../../shared/finance';
import type { TrendGranularity } from '../../shared/finance';
import {
  categoryRingArcs,
  chartColorAt,
  formatAxisMoney,
  formatMoney,
  formatSignedMoney,
  getAccountMeta,
  getCategoryMeta,
  groupTransactionsByDate,
  monthTitle,
  setAccountMetaOverrides,
  setCategoryMetaOverrides
} from '../../shared/uiHelpers';
import { exportTransactionsXlsx, readTransactionsFromFile, type ExportDestination } from './spreadsheet';
import type { TransactionType } from '../../shared/finance';
import {
  LedgerSnapshot,
  type AccountPatch,
  type CategoryPatch,
  addAccountToLedger,
  addCategoryToLedger,
  appendTransactionToLedger,
  ledgerFromImportedTransactions,
  newTransactionFromForm,
  removeAccountFromLedger,
  removeCategoryFromLedger,
  setCarryForwardInLedger,
  softDeleteInLedger,
  updateAccountInLedger,
  updateCategoryInLedger,
  updateTransactionInLedger,
  upsertBudgetInLedger
} from '../../shared/ledgerStore';
import {
  clearLocalLedger,
  loadLocalLedger,
  localLedgerExists,
  saveLocalLedger,
  loadShowcaseLedger,
  saveShowcaseLedger,
  clearShowcaseLedger,
  showcaseSessionActive,
  setShowcaseSessionActive
} from './storage/localAdapter';
import {
  applyTursoChange,
  clearTursoLedger,
  loadTursoLedger,
  loadTursoUpdatedAt,
  saveTursoLedger,
  testTursoConnection as runTursoConnectionTest,
  type LedgerChange
} from './storage/tursoAdapter';
import { loadStoragePreferences, saveStoragePreferences } from './storage/prefsStore';
import { loadLastSyncedRevision, saveLastSyncedRevision } from './storage/syncMetaStore';
import { isOnline, resolveEffectiveStorage } from './storage/activeStorage';
import { compareRevisions } from '../../shared/sync/revisions';
import { shouldCheck } from '../../shared/sync/cooldown';
import {
  deriveSyncPhase,
  type SyncActivity,
  type SyncPhase
} from '../../shared/sync/syncState';
import type { Revision } from '../../shared/sync/constants';
import { applyStorageSwitch } from './storage/switchMode';
import {
  SYNC_STATUS_LABEL,
  computeSyncStatus,
  resolveSyncCase,
  canShowSyncNow,
  type SyncStatus
} from './storage/syncPolicy';
import { isTursoConfigComplete } from '../../shared/storage/prefs';
import type {
  EffectiveStorageInfo,
  StorageMode,
  StoragePreferences,
  TursoConfig
} from '../../shared/storage/types';
import { buildShowcaseLedger } from '../../shared/showcaseData';

export type MainTab = 'trans' | 'stats' | 'categories' | 'accounts' | 'more';
export type HomeView = 'calendar' | 'weekly' | 'monthly' | 'summary';
export type LoadPhase = 'loading' | 'ready' | 'error';

/**
 * Case 4: both this device and Turso hold data, so the user must choose which
 * copy becomes the source of truth before continuing.
 */
export type ConflictInfo = {
  local: LedgerSnapshot;
  remote: LedgerSnapshot;
};

export { SYNC_STATUS_LABEL, SYNC_STATUS_SHORT, canShowSyncNow } from './storage/syncPolicy';
export type { SyncStatus } from './storage/syncPolicy';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): TransactionFormInput => ({
  date: today(),
  type: 'expense',
  amount: '',
  currency: 'INR',
  account: 'Cash',
  category: '',
  note: '',
  receiptUrl: ''
});

function applySnapshot(snapshot: LedgerSnapshot) {
  return {
    transactions: [...snapshot.transactions].reverse(),
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    budgets: snapshot.budgets
  };
}

export type ConfirmTone = 'default' | 'danger';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: string;
};

type LedgerState = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  carryForward: boolean;
  showcaseMode: boolean;
  busy: boolean;
  importProgress: number | null;
  exportProgress: number | null;
  loadPhase: LoadPhase;
  message: string;
  storagePrefs: StoragePreferences;
  effectiveStorage: EffectiveStorageInfo;
  syncStatus: SyncStatus;
  /** Rich display phase for the sync status UI (icon/label/description). */
  syncPhase: SyncPhase;
  /** ISO timestamp of the active snapshot, used for "last synced/updated" copy. */
  lastUpdatedAt: string | null;
  /** ISO timestamp of the last successful cloud sync, for "Last synced X ago". */
  lastSyncedAt: string | null;
  conflict: ConflictInfo | null;
  mainTab: MainTab;
  homeView: HomeView;
  selectedMonth: Date;
  filters: TransactionFilters;
  form: TransactionFormInput;
  editingId: string | null;
  showAdd: boolean;
  /** Category the user asked to inspect from the Stats view (one-shot). */
  categoryFocus: string | null;
  setMainTab: (tab: MainTab) => void;
  setHomeView: (view: HomeView) => void;
  setSelectedMonth: (date: Date) => void;
  setFilters: (filters: TransactionFilters) => void;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormInput>>;
  setShowAdd: (show: boolean) => void;
  /** Open the create-transaction flow with a specific date pre-filled. */
  addTransactionOn: (date: string) => void;
  /** Jump to the Categories tab focused on a category (keeps the current month). */
  focusCategory: (category: string) => void;
  /** Consume the one-shot category focus after the Categories view applies it. */
  clearCategoryFocus: () => void;
  exportPrompt: boolean;
  beginExport: () => void;
  cancelExport: () => void;
  /**
   * Manual Refresh: metadata-first check that pulls when the cloud is newer and
   * routes a real divergence to the conflict flow. Bypasses the cooldown.
   */
  refresh: () => Promise<void>;
  /**
   * Throttled, automatic metadata check used by navigation/focus/visibility
   * triggers. Auto-pulls only when the cloud is newer and local is clean.
   */
  checkForUpdates: () => Promise<void>;
  saveTransaction: () => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
  startEdit: (transaction: Transaction) => void;
  cancelEdit: () => void;
  saveBudget: (category: string, amount: string) => Promise<void>;
  addAccount: (name: string, currency: string, openingBalance: string) => Promise<void>;
  updateAccount: (originalName: string, patch: AccountPatch) => Promise<void>;
  deleteAccount: (name: string) => Promise<void>;
  addCategory: (name: string, type: TransactionType) => Promise<void>;
  updateCategory: (originalName: string, patch: CategoryPatch) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  setCarryForward: (value: boolean) => Promise<void>;
  exportData: (destination?: ExportDestination) => Promise<void>;
  importData: (file: File) => Promise<void>;
  resetAllData: () => Promise<void>;
  enableShowcaseMode: () => Promise<void>;
  exitShowcaseMode: () => Promise<void>;
  testTursoConnection: (config: TursoConfig) => Promise<void>;
  applyStorageSettings: (
    next: StoragePreferences,
    confirmReplace: (targetMode: StorageMode) => Promise<boolean> | boolean
  ) => Promise<boolean>;
  /**
   * Connect this device to an existing Turso database without overwriting the
   * remote: persists credentials and reloads so boot reconciliation pulls the
   * shared data (or prompts on a real conflict). Used by device pairing.
   */
  joinTursoDevice: (credentials: TursoConfig) => Promise<void>;
  syncNow: () => Promise<void>;
  resolveConflict: (choice: 'local' | 'turso') => Promise<void>;
  importExcelToTurso: (file: File) => Promise<void>;
  /** Active confirmation dialog request, or null when none is open. */
  confirmDialog: ConfirmRequest | null;
  /** Resolve the open confirmation dialog with the user's choice. */
  answerConfirm: (result: boolean) => void;
};

const LedgerContext = createContext<LedgerState | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [carryForward, setCarryForwardState] = useState(false);
  const [showcaseMode, setShowcaseModeState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading');
  const [message, setMessage] = useState('');
  const bootstrappedRef = useRef(false);
  // When true, reads/writes are redirected to the isolated showcase key so the
  // user's real ledger is never modified while demo data is on screen.
  const showcaseActiveRef = useRef(showcaseSessionActive());

  const storagePrefsRef = useRef<StoragePreferences>(loadStoragePreferences());
  const [storagePrefs, setStoragePrefs] = useState<StoragePreferences>(() => storagePrefsRef.current);
  const [effectiveStorage, setEffectiveStorage] = useState<EffectiveStorageInfo>(() =>
    resolveEffectiveStorage(storagePrefsRef.current)
  );
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    computeSyncStatus(resolveEffectiveStorage(storagePrefsRef.current), null, null)
  );
  // Transient sync work and the last known local/cloud relationship feed the
  // rich display phase. The baseline ref records the cloud revision at the last
  // successful sync so we can tell a one-sided change from a real divergence.
  const [syncActivity, setSyncActivity] = useState<SyncActivity>('idle');
  const [comparison, setComparison] = useState<'up_to_date' | 'cloud_newer' | 'local_newer' | 'diverged' | null>(
    null
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastSyncedRevisionRef = useRef<Revision>(loadLastSyncedRevision());
  const lastSyncCheckAtRef = useRef<number | null>(null);
  const inFlightCheckRef = useRef<Promise<void> | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('trans');
  const [homeView, setHomeView] = useState<HomeView>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<TransactionFilters>({ type: 'all' });
  const [form, setForm] = useState<TransactionFormInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [exportPrompt, setExportPrompt] = useState(false);
  const [categoryFocus, setCategoryFocus] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmRequest | null>(null);
  const confirmResolveRef = useRef<((result: boolean) => void) | null>(null);

  /** Open a custom confirmation dialog and resolve once the user responds. */
  function requestConfirm(request: ConfirmRequest): Promise<boolean> {
    // Resolve any dialog already waiting (shouldn't normally happen) as cancelled.
    confirmResolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmDialog(request);
    });
  }

  function answerConfirm(result: boolean) {
    setConfirmDialog(null);
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    resolve?.(result);
  }

  function focusCategory(category: string) {
    setCategoryFocus(category);
    setMainTab('categories');
  }

  function clearCategoryFocus() {
    setCategoryFocus(null);
  }

  // Navigation between major sections is a natural moment to look for cloud
  // updates — throttled so rapid switching issues at most one request.
  function navigateTab(tab: MainTab) {
    setMainTab(tab);
    void checkForUpdates();
  }

  const currentMonth = monthKey(selectedMonth);

  // Rich display phase, derived from live state so it never goes stale.
  const syncPhase = useMemo<SyncPhase>(
    () =>
      deriveSyncPhase({
        preferredMode: effectiveStorage.preferredMode,
        isOnline: effectiveStorage.isOnline,
        effectiveMode: effectiveStorage.effectiveMode,
        activity: syncActivity,
        hasConflict: conflict !== null,
        comparison
      }),
    [effectiveStorage, syncActivity, conflict, comparison]
  );

  /** Record the cloud revision we are now in sync with (ref + persisted + UI). */
  function recordSyncedRevision(revision: Revision) {
    lastSyncedRevisionRef.current = revision;
    saveLastSyncedRevision(revision);
    setComparison('up_to_date');
    setLastSyncedAt(new Date().toISOString());
  }

  function syncFromSnapshot(next: LedgerSnapshot) {
    setSnapshot(next);
    const applied = applySnapshot(next);
    setTransactions(applied.transactions);
    setAccounts(applied.accounts);
    setCategories(applied.categories);
    setBudgets(applied.budgets);
    setCarryForwardState(next.settings?.carryForward ?? false);
    setShowcaseModeState(next.settings?.showcaseMode ?? false);
    setCategoryMetaOverrides(applied.categories);
    setAccountMetaOverrides(applied.accounts);
  }

  // Read from whichever store is effective now. When Turso is active we also
  // refresh the local cache so offline fallback shows recent data.
  async function loadActiveLedger(): Promise<LedgerSnapshot> {
    if (showcaseActiveRef.current) return loadShowcaseLedger();
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    if (info.effectiveMode === 'turso') {
      const remote = await loadTursoLedger(prefs.turso);
      await saveLocalLedger(remote);
      return remote;
    }
    return loadLocalLedger();
  }

  // Persist a mutation. When Turso is active, `change` drives a granular
  // single-row write (no full-ledger rewrite); omit it for bulk replacements
  // (import/showcase) where the whole snapshot is rewritten.
  async function persist(next: LedgerSnapshot, change?: LedgerChange) {
    // Showcase session: keep everything in the isolated demo key. The real
    // ledger (local + Turso) is left untouched.
    if (showcaseActiveRef.current) {
      await saveShowcaseLedger(next);
      syncFromSnapshot(next);
      return;
    }
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    if (info.effectiveMode === 'turso') {
      await applyTursoChange(prefs.turso, next, change);
    }
    // Always keep a local copy: the source of truth for local mode and the
    // offline cache for Turso mode.
    await saveLocalLedger(next);
    syncFromSnapshot(next);
    await refreshSyncStatus();
  }

  // Clear the effective store (and the local cache when Turso is active).
  async function clearActiveLedger(): Promise<LedgerSnapshot> {
    // In a showcase session, "erase" only resets the demo copy.
    if (showcaseActiveRef.current) {
      const fresh = buildShowcaseLedger();
      await saveShowcaseLedger(fresh);
      return fresh;
    }
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    if (info.effectiveMode === 'turso') {
      const fresh = await clearTursoLedger(prefs.turso);
      await saveLocalLedger(fresh);
      return fresh;
    }
    return clearLocalLedger();
  }

  function bootMessage(info: EffectiveStorageInfo): string {
    if (info.effectiveMode === 'turso') {
      return 'Connected to Turso. Your data syncs across devices that use these credentials.';
    }
    if (info.isTursoFallback) {
      return info.isOnline
        ? 'Using the local copy — not synced with Turso yet. Tap Sync now in the header to push.'
        : 'Turso is unavailable (offline). Using the local copy on this device for now.';
    }
    return 'Your data is stored on this device. Export CSV to back up or move between devices.';
  }

  /** Compare local cache vs Turso `ledger_updated_at` and update the header pill. */
  async function refreshSyncStatus() {
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    setEffectiveStorage(info);
    if (info.preferredMode !== 'turso' || !isTursoConfigComplete(prefs.turso)) {
      setSyncStatus('local');
      return;
    }
    if (!info.isOnline) {
      setSyncStatus('offline');
      return;
    }
    if (info.effectiveMode !== 'turso') {
      setSyncStatus('not_synced');
      return;
    }
    try {
      const local = await loadLocalLedger();
      const tursoUpdatedAt = await loadTursoUpdatedAt(prefs.turso);
      setSyncStatus(computeSyncStatus(info, local.updatedAt, tursoUpdatedAt));
    } catch {
      setSyncStatus('not_synced');
    }
  }

  /**
   * Resolve the Turso connection cases on boot (see syncPolicy):
   *  - fresh / pull → use the Turso snapshot and cache it locally.
   *  - push_local   → local has data, Turso is empty: push it up.
   *  - conflict     → both have data: show the dialog, keep local meanwhile.
   */
  async function bootstrapTurso(): Promise<{ snapshot: LedgerSnapshot; message: string }> {
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    const remote = await loadTursoLedger(prefs.turso);
    const local = localLedgerExists() ? await loadLocalLedger() : null;
    // Identical copies (e.g. right after a mode switch) are already in sync —
    // no conflict prompt needed.
    if (local && local.updatedAt === remote.updatedAt) {
      await saveLocalLedger(remote);
      recordSyncedRevision(remote.updatedAt ?? null);
      await refreshSyncStatus();
      return { snapshot: remote, message: bootMessage(info) };
    }
    const localEmpty = !local || local.transactions.length === 0;
    const tursoEmpty = remote.transactions.length === 0;
    const syncCase = resolveSyncCase({ connected: true, localEmpty, tursoEmpty });

    if (syncCase === 'conflict' && local) {
      setConflict({ local, remote });
      setComparison('diverged');
      setSyncStatus('not_synced');
      return {
        snapshot: local,
        message: 'This device and Turso both have data. Choose which copy to keep.'
      };
    }

    if (syncCase === 'push_local' && local) {
      await saveTursoLedger(prefs.turso, local);
      await saveLocalLedger(local);
      recordSyncedRevision(local.updatedAt ?? null);
      await refreshSyncStatus();
      return { snapshot: local, message: 'Pushed your local data to Turso.' };
    }

    // fresh or pull: Turso is authoritative; mirror it into the local cache.
    await saveLocalLedger(remote);
    recordSyncedRevision(remote.updatedAt ?? null);
    await refreshSyncStatus();
    return { snapshot: remote, message: bootMessage(info) };
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      try {
        // A showcase session was active on the last visit — restore the demo
        // copy without reading the real local/Turso ledger.
        if (showcaseActiveRef.current) {
          const demo = await loadShowcaseLedger();
          syncFromSnapshot(demo);
          setLoadPhase('ready');
          setMessage('Showcase mode is on — demo data. Your real data is preserved and untouched.');
          return;
        }
        const info = resolveEffectiveStorage(storagePrefsRef.current);
        setEffectiveStorage(info);
        if (info.effectiveMode === 'turso') {
          const { snapshot, message } = await bootstrapTurso();
          syncFromSnapshot(snapshot);
          await refreshSyncStatus();
          setLoadPhase('ready');
          setMessage(message);
        } else {
          const loaded = await loadLocalLedger();
          syncFromSnapshot(loaded);
          await refreshSyncStatus();
          setLoadPhase('ready');
          setMessage(bootMessage(resolveEffectiveStorage(storagePrefsRef.current)));
        }
      } catch (error) {
        // Turso failed at boot: fall back to the local cache so the app still opens.
        try {
          const local = await loadLocalLedger();
          syncFromSnapshot(local);
          const fallbackInfo: EffectiveStorageInfo = {
            preferredMode: storagePrefsRef.current.mode,
            effectiveMode: 'local',
            isTursoFallback: storagePrefsRef.current.mode === 'turso',
            isOnline: typeof navigator === 'undefined' ? true : navigator.onLine
          };
          setEffectiveStorage(fallbackInfo);
          await refreshSyncStatus();
          setLoadPhase('ready');
          setMessage(`Could not reach Turso (${errorMessage(error)}). Showing the local copy.`);
        } catch (fallbackError) {
          setLoadPhase('error');
          setMessage(errorMessage(fallbackError));
        }
      }
    })();
  }, []);

  // React to connectivity changes for Turso mode: drop to local cache offline,
  // and surface a sync prompt if local and remote diverged while offline.
  useEffect(() => {
    function handleOffline() {
      void refreshSyncStatus();
    }

    // On reconnect, run the baseline-aware metadata check (bypassing the
    // cooldown). It auto-pulls when only the cloud changed, auto-pushes when
    // only this device changed (Case A — no prompt), and flags a real two-sided
    // divergence as a conflict to resolve via Refresh.
    async function handleOnline() {
      const prefs = storagePrefsRef.current;
      if (prefs.mode !== 'turso' || !isTursoConfigComplete(prefs.turso)) {
        await refreshSyncStatus();
        return;
      }
      setEffectiveStorage(resolveEffectiveStorage(prefs));
      await checkForUpdates({ force: true });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Metadata-first sync check. Compares the local snapshot's `updatedAt` to the
   * Turso `ledger_updated_at` marker (no full download) and reconciles:
   *  - up_to_date  → just record the baseline.
   *  - cloud_newer → pull the full ledger (local is clean, safe to replace).
   *  - local_newer → flag "not synced" (auto) or push (manual Refresh).
   *  - diverged    → flag conflict (auto) or open the conflict dialog (manual).
   *
   * `manual` Refresh bypasses the cooldown and surfaces conflicts; automatic
   * checks are throttled and never clobber local edits. Concurrent calls are
   * coalesced via `inFlightCheckRef`.
   */
  async function checkForUpdates(options?: { manual?: boolean; force?: boolean }): Promise<void> {
    const manual = options?.manual ?? false;
    // `force` bypasses the cooldown (e.g. reconnect) without treating the check
    // as a manual action — so a real conflict is flagged, not auto-prompted.
    const force = options?.force ?? manual;
    const prefs = storagePrefsRef.current;

    // Only meaningful when Turso is the chosen store and not in a demo session.
    if (showcaseActiveRef.current || prefs.mode !== 'turso' || !isTursoConfigComplete(prefs.turso)) {
      if (manual) await refresh();
      return;
    }
    if (!isOnline()) {
      await refreshSyncStatus();
      return;
    }
    // Coalesce rapid triggers (tab switching / refresh spam).
    if (inFlightCheckRef.current) return inFlightCheckRef.current;
    if (!force && !shouldCheck(lastSyncCheckAtRef.current)) return;

    const run = (async () => {
      lastSyncCheckAtRef.current = Date.now();
      setSyncActivity('checking');
      try {
        const local = await loadLocalLedger();
        const remoteRev = await loadTursoUpdatedAt(prefs.turso);
        const cmp = compareRevisions(local.updatedAt ?? null, remoteRev, lastSyncedRevisionRef.current);

        if (cmp === 'up_to_date') {
          recordSyncedRevision(remoteRev);
          await refreshSyncStatus();
          return;
        }

        if (cmp === 'cloud_newer') {
          // Local is clean relative to the baseline → safe to adopt the cloud copy.
          setSyncActivity('syncing');
          const remote = await loadTursoLedger(prefs.turso);
          await saveLocalLedger(remote);
          syncFromSnapshot(remote);
          recordSyncedRevision(remote.updatedAt ?? null);
          await refreshSyncStatus();
          setMessage('Updated from the cloud.');
          return;
        }

        if (cmp === 'local_newer') {
          // Only this device changed since the last sync; the cloud still
          // matches our baseline, so pushing can't clobber anyone. Auto-push on
          // both automatic checks and manual Refresh (no conflict, no prompt).
          setComparison('local_newer');
          try {
            setSyncActivity('syncing');
            await saveTursoLedger(prefs.turso, local);
            recordSyncedRevision(local.updatedAt ?? null);
            setMessage(manual ? 'Pushed your changes to the cloud.' : 'Synced your changes to the cloud.');
          } catch (pushError) {
            // Push failed (e.g. flaky network): keep the cached data and leave
            // the pill at "Not synced" so a later check/Refresh retries.
            if (manual) {
              setMessage(`Could not push to the cloud (${errorMessage(pushError)}). Your changes are saved locally.`);
            }
          }
          await refreshSyncStatus();
          return;
        }

        // diverged: both sides moved since the last common sync.
        setComparison('diverged');
        if (manual) {
          const remote = await loadTursoLedger(prefs.turso);
          setConflict({ local, remote });
          setMessage('This device and the cloud both changed. Choose which copy to keep.');
        }
      } catch (error) {
        // Leave the cache intact; only the manual path narrates the failure.
        if (manual) setMessage(`Could not reach the cloud (${errorMessage(error)}). Showing local data.`);
      } finally {
        setSyncActivity('idle');
      }
    })();

    inFlightCheckRef.current = run;
    try {
      await run;
    } finally {
      inFlightCheckRef.current = null;
    }
  }

  async function refresh() {
    const prefs = storagePrefsRef.current;
    // Turso mode: run the metadata-first manual flow (handles pull/push/conflict).
    if (!showcaseActiveRef.current && prefs.mode === 'turso' && isTursoConfigComplete(prefs.turso)) {
      await checkForUpdates({ manual: true });
      return;
    }
    // Local / showcase: reload from the active store.
    if (!snapshot) return;
    setBusy(true);
    try {
      const info = resolveEffectiveStorage(prefs);
      setEffectiveStorage(info);
      const loaded = await loadActiveLedger();
      syncFromSnapshot(loaded);
      setMessage('Ledger refreshed from local storage.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveTransaction() {
    if (!snapshot) return;
    setBusy(true);
    try {
      if (editingId) {
        const existing = transactions.find((t) => t.id === editingId);
        if (!existing) throw new Error('Transaction not found.');
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Enter a valid amount greater than zero.');
        }
        const updated: Transaction = {
          ...existing,
          date: form.date,
          type: form.type,
          amount,
          currency: form.currency.trim() || 'INR',
          account: form.account.trim() || 'Cash',
          category: form.category.trim() || 'Other',
          note: form.note.trim(),
          receiptUrl: form.receiptUrl?.trim() || undefined,
          updatedAt: new Date().toISOString()
        };
        const next = updateTransactionInLedger(snapshot, updated);
        await persist(next, { kind: 'updateTransaction', transaction: updated });
        setEditingId(null);
        setForm(emptyForm());
        setShowAdd(false);
        setMessage('Transaction updated.');
      } else {
        const transaction = newTransactionFromForm(form, 'web');
        const next = appendTransactionToLedger(snapshot, transaction);
        await persist(next, { kind: 'insertTransaction', transaction });
        setForm(emptyForm());
        setShowAdd(false);
        setMessage('Transaction saved.');
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!snapshot) return;
    const confirmed = await requestConfirm({
      icon: '🗑️',
      tone: 'danger',
      title: 'Delete this transaction?',
      message: 'This transaction will be removed from your ledger. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const next = softDeleteInLedger(snapshot, transaction);
      await persist(next, { kind: 'deleteTransaction', id: transaction.id });
      setMessage('Transaction deleted.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setForm({
      date: transaction.date,
      type: transaction.type,
      amount: String(transaction.amount),
      currency: transaction.currency,
      account: transaction.account,
      category: transaction.category,
      note: transaction.note,
      receiptUrl: transaction.receiptUrl ?? ''
    });
    setShowAdd(true);
    setMainTab('trans');
  }

  function addTransactionOn(date: string) {
    setEditingId(null);
    setForm({ ...emptyForm(), date });
    setShowAdd(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setShowAdd(false);
  }

  async function saveBudget(category: string, amountText: string) {
    if (!snapshot) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    try {
      const budget: Budget = { category, month: currentMonth, amount, currency: 'INR' };
      const next = upsertBudgetInLedger(snapshot, budget);
      await persist(next, { kind: 'upsertBudget', budget });
      setMessage('Budget saved.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addAccount(name: string, currency: string, openingBalance: string) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = addAccountToLedger(snapshot, {
        name,
        currency,
        openingBalance: Number(openingBalance) || 0,
        active: true
      });
      const account = next.accounts[next.accounts.length - 1];
      await persist(next, { kind: 'saveAccount', account });
      setMessage(`Account "${name.trim()}" added.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateAccount(originalName: string, patch: AccountPatch) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = updateAccountInLedger(snapshot, originalName, patch);
      const nextName = patch.name?.trim() || originalName;
      const account = next.accounts.find((a) => a.name === nextName) ?? next.accounts[0];
      await persist(next, { kind: 'renameAccount', from: originalName, account });
      setForm((current) => (current.account === originalName ? { ...current, account: nextName } : current));
      setMessage(`Account "${nextName}" updated.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(name: string) {
    if (!snapshot) return;
    const confirmed = await requestConfirm({
      icon: '🏦',
      tone: 'danger',
      title: `Remove account "${name}"?`,
      message: 'Existing transactions keep their data, but this account will no longer be selectable.',
      confirmLabel: 'Remove account',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const next = removeAccountFromLedger(snapshot, name);
      await persist(next, { kind: 'removeAccount', name });
      setForm((current) => (current.account === name ? { ...current, account: next.accounts[0]?.name ?? '' } : current));
      setMessage(`Account "${name}" removed.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(name: string, type: TransactionType) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = addCategoryToLedger(snapshot, { name, type, active: true });
      const category = next.categories[next.categories.length - 1];
      await persist(next, { kind: 'saveCategory', category });
      setMessage(`Category "${name.trim()}" added.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateCategory(originalName: string, patch: CategoryPatch) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = updateCategoryInLedger(snapshot, originalName, patch);
      const nextName = patch.name?.trim() || originalName;
      const category = next.categories.find((c) => c.name === nextName) ?? next.categories[0];
      await persist(next, { kind: 'renameCategory', from: originalName, category });
      setForm((current) => (current.category === originalName ? { ...current, category: nextName } : current));
      setMessage(`Category "${nextName}" updated.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(name: string) {
    if (!snapshot) return;
    const confirmed = await requestConfirm({
      icon: '🗂️',
      tone: 'danger',
      title: `Remove category "${name}"?`,
      message: 'Existing transactions keep their data, but this category will no longer be selectable.',
      confirmLabel: 'Remove category',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const next = removeCategoryFromLedger(snapshot, name);
      await persist(next, { kind: 'removeCategory', name });
      setForm((current) => (current.category === name ? { ...current, category: next.categories[0]?.name ?? '' } : current));
      setMessage(`Category "${name}" removed.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function setCarryForward(value: boolean) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = setCarryForwardInLedger(snapshot, value);
      await persist(next, { kind: 'setSettings', settings: next.settings });
      setMessage(value ? 'Monthly carry-forward enabled.' : 'Monthly carry-forward disabled.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function beginExport() {
    setExportPrompt(true);
  }

  function cancelExport() {
    setExportPrompt(false);
  }

  async function exportData(destination: ExportDestination = { mode: 'default' }) {
    setExportPrompt(false);
    setBusy(true);
    setExportProgress(0);
    try {
      await exportTransactionsXlsx(transactions, {
        destination,
        onProgress: (fraction) => setExportProgress(Math.min(0.98, fraction))
      });
      setExportProgress(1);
      setMessage(
        destination.mode === 'picker'
          ? 'Excel workbook saved to the chosen location.'
          : 'Excel workbook downloaded. Open it in Excel or Google Sheets.'
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
      setExportProgress(null);
    }
  }

  async function importData(file: File) {
    if (!snapshot) return;

    const confirmed = await requestConfirm({
      icon: '⬆️',
      tone: 'danger',
      title: `Import "${file.name}"?`,
      message:
        'All existing data on this device will be removed and replaced with transactions from the file. ' +
        'Budgets will also be reset. Export a backup first if you need it.',
      confirmLabel: 'Import & replace',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;

    setBusy(true);
    setImportProgress(0);
    setMessage(`Reading "${file.name}"…`);
    try {
      const imported = await readTransactionsFromFile(file, (fraction) => {
        setImportProgress(Math.min(0.98, fraction));
      });
      const next = ledgerFromImportedTransactions(imported);
      await persist(next);
      setImportProgress(1);
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setMessage(`Imported ${imported.length} transactions. Previous data was replaced.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
      setImportProgress(null);
    }
  }

  async function enableShowcaseMode() {
    if (!snapshot) return;

    const confirmed = await requestConfirm({
      icon: '🎬',
      tone: 'default',
      title: 'Enable Showcase Mode?',
      message:
        'Loads demo data into a separate sandbox so you can explore the app. ' +
        'Your real records stay safe and are restored automatically when you exit showcase mode.',
      confirmLabel: 'Enable showcase',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const demo = buildShowcaseLedger();
      // Switch into the isolated showcase session before persisting so the demo
      // data is written to its own key, never the real ledger.
      showcaseActiveRef.current = true;
      setShowcaseSessionActive(true);
      await saveShowcaseLedger(demo);
      syncFromSnapshot(demo);
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setSelectedMonth(new Date());
      setMessage(`Showcase mode on — ${demo.transactions.length} demo transactions loaded. Your real data is safe.`);
    } catch (error) {
      showcaseActiveRef.current = false;
      setShowcaseSessionActive(false);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function exitShowcaseMode() {
    if (!snapshot) return;

    const confirmed = await requestConfirm({
      icon: '↩️',
      tone: 'default',
      title: 'Exit Showcase Mode?',
      message:
        'The demo data will be discarded and your original ledger will be restored exactly as you left it. ' +
        'Nothing you had before showcase mode is lost.',
      confirmLabel: 'Exit showcase',
      cancelLabel: 'Stay in showcase'
    });
    if (!confirmed) return;

    // New (sandboxed) session keeps real data in the effective store, so we can
    // simply reload it. A legacy session (demo written into the real key by an
    // older build) has no preserved original, so we clear it to a fresh ledger.
    const sandboxed = showcaseActiveRef.current;

    setBusy(true);
    try {
      showcaseActiveRef.current = false;
      setShowcaseSessionActive(false);
      clearShowcaseLedger();

      let original: LedgerSnapshot;
      if (sandboxed) {
        original = await loadActiveLedger();
      } else {
        // Demo data lives in the real store and the original was already lost by
        // the old implementation — reset to an empty ledger so showcase turns off.
        original = await clearActiveLedger();
      }
      // Defensively make sure the showcase flag is cleared in what we restore.
      if (original.settings?.showcaseMode) {
        original = { ...original, settings: { ...original.settings, showcaseMode: false } };
        await persist(original);
      } else {
        syncFromSnapshot(original);
      }
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      await refreshSyncStatus();
      setMessage(
        sandboxed
          ? 'Showcase mode off. Your original data is back.'
          : 'Showcase mode off. Demo data cleared.'
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetAllData() {
    const confirmed = await requestConfirm({
      icon: '🗑️',
      tone: 'danger',
      title: 'Erase all data?',
      message:
        'This removes transactions, budgets, and custom accounts/categories from this browser. ' +
        'Export an Excel backup first if you need it. This cannot be undone.',
      confirmLabel: 'Erase everything',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const fresh = await clearActiveLedger();
      syncFromSnapshot(fresh);
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setMessage('All data was cleared.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function testTursoConnection(config: TursoConfig) {
    await runTursoConnectionTest(config);
  }

  async function applyStorageSettings(
    next: StoragePreferences,
    confirmReplace: (targetMode: StorageMode) => Promise<boolean> | boolean
  ): Promise<boolean> {
    setBusy(true);
    try {
      const result = await applyStorageSwitch({
        current: storagePrefsRef.current,
        next,
        confirmReplace
      });
      if (!result) return false;
      saveStoragePreferences(next);
      storagePrefsRef.current = next;
      setStoragePrefs(next);
      // Reload so the whole app re-boots cleanly against the new store.
      window.location.reload();
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Connect this device to an existing Turso database (via QR pairing or the
   * Advanced fields). Unlike {@link applyStorageSettings}, this never pushes the
   * local cache over the remote: it persists the credentials and reloads, then
   * boot reconciliation pulls the remote data when this device is empty, pushes
   * up when only the remote is empty, or prompts on a genuine two-sided
   * conflict. This is what makes a freshly paired device adopt the shared data
   * instead of wiping it.
   */
  async function joinTursoDevice(credentials: TursoConfig): Promise<void> {
    const next: StoragePreferences = { mode: 'turso', turso: credentials };
    saveStoragePreferences(next);
    storagePrefsRef.current = next;
    setStoragePrefs(next);
    // Full reload so bootstrapTurso performs the four-case reconciliation.
    window.location.reload();
  }

  /**
   * Re-check local vs Turso and reconcile. Pulls/pushes when only one side has
   * data; on a genuine two-sided divergence it opens the conflict dialog rather
   * than merging silently.
   */
  async function syncNow() {
    const prefs = storagePrefsRef.current;
    if (!isTursoConfigComplete(prefs.turso)) {
      setMessage('Configure Turso under More → Storage, then Save & Reload.');
      return;
    }
    if (!isOnline()) {
      setMessage('Go online to sync with Turso.');
      return;
    }
    setBusy(true);
    try {
      const [remote, local] = await Promise.all([loadTursoLedger(prefs.turso), loadLocalLedger()]);
      if (local.updatedAt === remote.updatedAt && remote.transactions.length > 0) {
        setEffectiveStorage(resolveEffectiveStorage(prefs));
        recordSyncedRevision(remote.updatedAt ?? null);
        await refreshSyncStatus();
        setMessage('Already in sync with Turso.');
        return;
      }
      const syncCase = resolveSyncCase({
        connected: true,
        localEmpty: local.transactions.length === 0,
        tursoEmpty: remote.transactions.length === 0
      });
      if (syncCase === 'pull') {
        await saveLocalLedger(remote);
        syncFromSnapshot(remote);
        recordSyncedRevision(remote.updatedAt ?? null);
        setMessage('Pulled the latest data from Turso.');
      } else if (syncCase === 'fresh' || syncCase === 'push_local') {
        await saveTursoLedger(prefs.turso, local);
        await saveLocalLedger(local);
        syncFromSnapshot(local);
        recordSyncedRevision(local.updatedAt ?? null);
        setMessage(`Pushed ${local.transactions.length} transactions to Turso.`);
      } else {
        setConflict({ local, remote });
        setMessage('Choose which copy to keep.');
        return;
      }
      setConflict(null);
      setEffectiveStorage(resolveEffectiveStorage(prefs));
      await refreshSyncStatus();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  /** Resolve a Case-4 conflict by choosing the authoritative copy. */
  async function resolveConflict(choice: 'local' | 'turso') {
    const pending = conflict;
    if (!pending) return;
    const prefs = storagePrefsRef.current;
    setBusy(true);
    try {
      if (choice === 'local') {
        await saveTursoLedger(prefs.turso, pending.local);
        await saveLocalLedger(pending.local);
        syncFromSnapshot(pending.local);
        recordSyncedRevision(pending.local.updatedAt ?? null);
        setMessage('Turso was replaced with the data from this device.');
      } else {
        await saveLocalLedger(pending.remote);
        syncFromSnapshot(pending.remote);
        recordSyncedRevision(pending.remote.updatedAt ?? null);
        setMessage('This device now shows the data from Turso.');
      }
      setConflict(null);
      setSyncStatus('synced');
      await refreshSyncStatus();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Settings action: import an Excel/CSV file and push it to Turso, replacing
   * the remote database. Distinct from `importData`, which targets only the
   * local device. Requires an active Turso connection.
   */
  async function importExcelToTurso(file: File) {
    const prefs = storagePrefsRef.current;
    if (!isTursoConfigComplete(prefs.turso) || !isOnline()) {
      setMessage('Connect to Turso to import.');
      throw new Error('Connect to Turso to import.');
    }
    setBusy(true);
    setImportProgress(0);
    setMessage(`Reading "${file.name}"…`);
    try {
      const imported = await readTransactionsFromFile(file, (fraction) => {
        setImportProgress(Math.min(0.9, fraction));
      });
      const confirmed = await requestConfirm({
        icon: '☁️',
        tone: 'danger',
        title: 'Import and sync to Turso?',
        message:
          `Import ${imported.length} transactions from "${file.name}" and sync to Turso? ` +
          'This will replace all data in your Turso database and on this device.',
        confirmLabel: 'Import & sync',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;
      const next = ledgerFromImportedTransactions(imported);
      await saveTursoLedger(prefs.turso, next);
      await saveLocalLedger(next);
      syncFromSnapshot(next);
      setImportProgress(1);
      setSyncStatus('synced');
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setMessage(`Imported ${imported.length} transactions and synced to Turso.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
      setImportProgress(null);
    }
  }

  const value: LedgerState = {
    transactions,
    accounts,
    categories,
    budgets,
    carryForward,
    showcaseMode,
    busy,
    importProgress,
    exportProgress,
    loadPhase,
    message,
    storagePrefs,
    effectiveStorage,
    syncStatus,
    syncPhase,
    lastUpdatedAt: snapshot?.updatedAt ?? null,
    lastSyncedAt,
    conflict,
    mainTab,
    homeView,
    selectedMonth,
    filters,
    form,
    editingId,
    showAdd,
    categoryFocus,
    setMainTab: navigateTab,
    setHomeView,
    setSelectedMonth,
    setFilters,
    setForm,
    setShowAdd,
    addTransactionOn,
    focusCategory,
    clearCategoryFocus,
    exportPrompt,
    beginExport,
    cancelExport,
    refresh,
    checkForUpdates,
    saveTransaction,
    deleteTransaction,
    startEdit,
    cancelEdit,
    saveBudget,
    addAccount,
    updateAccount,
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    setCarryForward,
    exportData,
    importData,
    resetAllData,
    enableShowcaseMode,
    exitShowcaseMode,
    testTursoConnection,
    applyStorageSettings,
    joinTursoDevice,
    syncNow,
    resolveConflict,
    importExcelToTurso,
    confirmDialog,
    answerConfirm
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger required');
  return ctx;
}

export {
  formatMoney,
  formatSignedMoney,
  getAccountMeta,
  getCategoryMeta,
  groupTransactionsByDate,
  categoryRingArcs,
  chartColorAt,
  formatAxisMoney,
  monthTitle,
  monthKey,
  summarizeMonth,
  summarizeWeek,
  summarizeByCategory,
  buildCalendarMonth,
  buildCategoryTrends,
  computeAccountBalances,
  carryOverBalance,
  transactionsInMonth,
  budgetProgressForMonth,
  filterTransactions
};
export type { TrendGranularity };
