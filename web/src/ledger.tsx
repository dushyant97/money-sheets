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
import { exportTransactionsXlsx, readTransactionsFromFile } from './spreadsheet';
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
import { clearLocalLedger, loadLocalLedger, saveLocalLedger } from './storage/localAdapter';
import {
  clearTursoLedger,
  loadTursoLedger,
  saveTursoLedger,
  testTursoConnection as runTursoConnectionTest
} from './storage/tursoAdapter';
import { loadStoragePreferences, saveStoragePreferences } from './storage/prefsStore';
import { resolveEffectiveStorage } from './storage/activeStorage';
import { applyStorageSwitch } from './storage/switchMode';
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

/** Shown after reconnecting when the local cache and Turso copy diverge. */
export type ReconnectInfo = {
  localUpdatedAt: string;
  remoteUpdatedAt: string;
};

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
  loadPhase: LoadPhase;
  message: string;
  storagePrefs: StoragePreferences;
  effectiveStorage: EffectiveStorageInfo;
  reconnect: ReconnectInfo | null;
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
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  resetAllData: () => Promise<void>;
  enableShowcaseMode: () => Promise<void>;
  exitShowcaseMode: () => Promise<void>;
  testTursoConnection: (config: TursoConfig) => Promise<void>;
  applyStorageSettings: (
    next: StoragePreferences,
    confirmReplace: (targetMode: StorageMode) => Promise<boolean> | boolean
  ) => Promise<boolean>;
  syncLocalToTurso: () => Promise<void>;
  pullFromTurso: () => Promise<void>;
  dismissReconnect: () => void;
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
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading');
  const [message, setMessage] = useState('');
  const bootstrappedRef = useRef(false);

  const storagePrefsRef = useRef<StoragePreferences>(loadStoragePreferences());
  const [storagePrefs, setStoragePrefs] = useState<StoragePreferences>(() => storagePrefsRef.current);
  const [effectiveStorage, setEffectiveStorage] = useState<EffectiveStorageInfo>(() =>
    resolveEffectiveStorage(storagePrefsRef.current)
  );
  const [reconnect, setReconnect] = useState<ReconnectInfo | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('trans');
  const [homeView, setHomeView] = useState<HomeView>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<TransactionFilters>({ type: 'all' });
  const [form, setForm] = useState<TransactionFormInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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

  async function persist(next: LedgerSnapshot) {
    const prefs = storagePrefsRef.current;
    const info = resolveEffectiveStorage(prefs);
    if (info.effectiveMode === 'turso') {
      await saveTursoLedger(prefs.turso, next);
    }
    // Always keep a local copy: the source of truth for local mode and the
    // offline cache for Turso mode.
    await saveLocalLedger(next);
    syncFromSnapshot(next);
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
      return 'Turso is unavailable (offline). Using the local copy on this device for now.';
    }
    return 'Your data is stored on this device. Export CSV to back up or move between devices.';
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      try {
        const info = resolveEffectiveStorage(storagePrefsRef.current);
        setEffectiveStorage(info);
        const loaded = await loadActiveLedger();
        syncFromSnapshot(loaded);
        setLoadPhase('ready');
        setMessage(bootMessage(info));
      } catch (error) {
        // Turso failed at boot: fall back to the local cache so the app still opens.
        try {
          const local = await loadLocalLedger();
          syncFromSnapshot(local);
          setEffectiveStorage({
            preferredMode: storagePrefsRef.current.mode,
            effectiveMode: 'local',
            isTursoFallback: storagePrefsRef.current.mode === 'turso',
            isOnline: typeof navigator === 'undefined' ? true : navigator.onLine
          });
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
      setEffectiveStorage(resolveEffectiveStorage(storagePrefsRef.current));
    }

    async function handleOnline() {
      const prefs = storagePrefsRef.current;
      const info = resolveEffectiveStorage(prefs);
      setEffectiveStorage(info);
      if (prefs.mode !== 'turso' || !isTursoConfigComplete(prefs.turso)) return;
      try {
        const [remote, local] = await Promise.all([loadTursoLedger(prefs.turso), loadLocalLedger()]);
        if (local.updatedAt !== remote.updatedAt) {
          setReconnect({ localUpdatedAt: local.updatedAt, remoteUpdatedAt: remote.updatedAt });
        }
      } catch {
        // Still settling; ignore and let the next action surface any error.
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
        await persist(next);
        setEditingId(null);
        setForm(emptyForm());
        setShowAdd(false);
        setMessage('Transaction updated.');
      } else {
        const transaction = newTransactionFromForm(form, 'web');
        const next = appendTransactionToLedger(snapshot, transaction);
        await persist(next);
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
      await persist(next);
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
      await persist(next);
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
      await persist(next);
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
      await persist(next);
      const nextName = patch.name?.trim() || originalName;
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
      await persist(next);
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
      await persist(next);
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
      await persist(next);
      const nextName = patch.name?.trim() || originalName;
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
      await persist(next);
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
      await persist(next);
      setMessage(value ? 'Monthly carry-forward enabled.' : 'Monthly carry-forward disabled.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setBusy(true);
    try {
      await exportTransactionsXlsx(`money-sheets-${currentMonth}.xlsx`, transactions);
      setMessage('Excel workbook downloaded. Open it in Excel or Google Sheets.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
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

  async function syncLocalToTurso() {
    const prefs = storagePrefsRef.current;
    if (!isTursoConfigComplete(prefs.turso)) return;
    setBusy(true);
    try {
      const local = await loadLocalLedger();
      await saveTursoLedger(prefs.turso, local);
      syncFromSnapshot(local);
      setReconnect(null);
      setMessage('Local changes pushed to Turso.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function pullFromTurso() {
    const prefs = storagePrefsRef.current;
    if (!isTursoConfigComplete(prefs.turso)) return;
    setBusy(true);
    try {
      const remote = await loadTursoLedger(prefs.turso);
      await saveLocalLedger(remote);
      syncFromSnapshot(remote);
      setReconnect(null);
      setMessage('Pulled the latest data from Turso.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function dismissReconnect() {
    setReconnect(null);
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
    loadPhase,
    message,
    storagePrefs,
    effectiveStorage,
    reconnect,
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
    syncLocalToTurso,
    pullFromTurso,
    dismissReconnect
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
