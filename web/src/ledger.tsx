import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { clearLocalLedger, loadLocalLedger, localLedgerExists, saveLocalLedger } from './storage/localAdapter';
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
import { isOnline, resolveEffectiveStorage } from './storage/activeStorage';
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

export { SYNC_STATUS_LABEL, canShowSyncNow } from './storage/syncPolicy';
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
  conflict: ConflictInfo | null;
  mainTab: MainTab;
  homeView: HomeView;
  selectedMonth: Date;
  filters: TransactionFilters;
  form: TransactionFormInput;
  editingId: string | null;
  showAdd: boolean;
  setMainTab: (tab: MainTab) => void;
  setHomeView: (view: HomeView) => void;
  setSelectedMonth: (date: Date) => void;
  setFilters: (filters: TransactionFilters) => void;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormInput>>;
  setShowAdd: (show: boolean) => void;
  exportPrompt: boolean;
  beginExport: () => void;
  cancelExport: () => void;
  refresh: () => Promise<void>;
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
  syncNow: () => Promise<void>;
  resolveConflict: (choice: 'local' | 'turso') => Promise<void>;
  importExcelToTurso: (file: File) => Promise<void>;
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

  const storagePrefsRef = useRef<StoragePreferences>(loadStoragePreferences());
  const [storagePrefs, setStoragePrefs] = useState<StoragePreferences>(() => storagePrefsRef.current);
  const [effectiveStorage, setEffectiveStorage] = useState<EffectiveStorageInfo>(() =>
    resolveEffectiveStorage(storagePrefsRef.current)
  );
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    computeSyncStatus(resolveEffectiveStorage(storagePrefsRef.current), null, null)
  );
  const [mainTab, setMainTab] = useState<MainTab>('trans');
  const [homeView, setHomeView] = useState<HomeView>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<TransactionFilters>({ type: 'all' });
  const [form, setForm] = useState<TransactionFormInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [exportPrompt, setExportPrompt] = useState(false);

  const currentMonth = monthKey(selectedMonth);

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
      await refreshSyncStatus();
      return { snapshot: remote, message: bootMessage(info) };
    }
    const localEmpty = !local || local.transactions.length === 0;
    const tursoEmpty = remote.transactions.length === 0;
    const syncCase = resolveSyncCase({ connected: true, localEmpty, tursoEmpty });

    if (syncCase === 'conflict' && local) {
      setConflict({ local, remote });
      setSyncStatus('not_synced');
      return {
        snapshot: local,
        message: 'This device and Turso both have data. Choose which copy to keep.'
      };
    }

    if (syncCase === 'push_local' && local) {
      await saveTursoLedger(prefs.turso, local);
      await saveLocalLedger(local);
      await refreshSyncStatus();
      return { snapshot: local, message: 'Pushed your local data to Turso.' };
    }

    // fresh or pull: Turso is authoritative; mirror it into the local cache.
    await saveLocalLedger(remote);
    await refreshSyncStatus();
    return { snapshot: remote, message: bootMessage(info) };
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      try {
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

    // On reconnect, re-evaluate the connection cases: pull when only Turso has
    // newer data, prompt on a genuine conflict, otherwise flag "not synced" so
    // the user can push via "Sync now".
    async function handleOnline() {
      const prefs = storagePrefsRef.current;
      if (prefs.mode !== 'turso' || !isTursoConfigComplete(prefs.turso)) {
        await refreshSyncStatus();
        return;
      }
      const info = resolveEffectiveStorage(prefs);
      setEffectiveStorage(info);
      try {
        const [remote, local] = await Promise.all([loadTursoLedger(prefs.turso), loadLocalLedger()]);
        if (local.updatedAt === remote.updatedAt) {
          await refreshSyncStatus();
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
        } else if (syncCase === 'conflict') {
          setConflict({ local, remote });
        } else if (syncCase === 'push_local') {
          await saveTursoLedger(prefs.turso, local);
        }
        await refreshSyncStatus();
      } catch {
        await refreshSyncStatus();
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function refresh() {
    if (!snapshot) return;
    setBusy(true);
    try {
      const info = resolveEffectiveStorage(storagePrefsRef.current);
      setEffectiveStorage(info);
      const loaded = await loadActiveLedger();
      syncFromSnapshot(loaded);
      setMessage(info.effectiveMode === 'turso' ? 'Ledger refreshed from Turso.' : 'Ledger refreshed from local storage.');
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
    if (!snapshot || !window.confirm('Delete this transaction?')) return;
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
    if (!snapshot || !window.confirm(`Remove account "${name}"?\n\nExisting transactions keep their data, but this account will no longer be selectable.`)) return;
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
    if (!snapshot || !window.confirm(`Remove category "${name}"?\n\nExisting transactions keep their data, but this category will no longer be selectable.`)) return;
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

    const confirmed = window.confirm(
      `Import "${file.name}"?\n\nAll existing data on this device will be removed and replaced with transactions from the file. Budgets will also be reset.`
    );
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

    setBusy(true);
    try {
      const demo = buildShowcaseLedger();
      await persist(demo);
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setSelectedMonth(new Date());
      setMessage(`Showcase mode on — ${demo.transactions.length} demo transactions loaded.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function exitShowcaseMode() {
    if (!snapshot) return;

    const confirmed = window.confirm(
      'Exit Showcase Mode?\n\n' +
        'All demo data will be removed and the app will reset to an empty ledger.\n\n' +
        'Export first if you want to keep anything.\n\n' +
        'Continue?'
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const fresh = await clearActiveLedger();
      syncFromSnapshot(fresh);
      setForm(emptyForm());
      setEditingId(null);
      setShowAdd(false);
      setMessage('Showcase mode off. Ledger cleared.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetAllData() {
    const confirmed = window.confirm(
      'Erase all local data?\n\nThis removes transactions, budgets, and custom accounts/categories from this browser. Export a CSV first if you need a backup.'
    );
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
        setMessage('Pulled the latest data from Turso.');
      } else if (syncCase === 'fresh' || syncCase === 'push_local') {
        await saveTursoLedger(prefs.turso, local);
        await saveLocalLedger(local);
        syncFromSnapshot(local);
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
        setMessage('Turso was replaced with the data from this device.');
      } else {
        await saveLocalLedger(pending.remote);
        syncFromSnapshot(pending.remote);
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
      const confirmed = window.confirm(
        `Import ${imported.length} transactions from "${file.name}" and sync to Turso?\n\n` +
          'This will replace all data in your Turso database and on this device.'
      );
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
    conflict,
    mainTab,
    homeView,
    selectedMonth,
    filters,
    form,
    editingId,
    showAdd,
    setMainTab,
    setHomeView,
    setSelectedMonth,
    setFilters,
    setForm,
    setShowAdd,
    exportPrompt,
    beginExport,
    cancelExport,
    refresh,
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
    syncNow,
    resolveConflict,
    importExcelToTurso
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
