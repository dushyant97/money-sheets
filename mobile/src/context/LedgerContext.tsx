import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Account, Budget, Category, Transaction, TransactionFormInput, TransactionType } from '../../../shared/finance';
import { TransactionFilters, exportTransactionsCsv, monthKey } from '../../../shared/finance';
import { parseTransactionsCsv } from '../../../shared/csvImport';
import {
  LedgerSnapshot,
  addAccountToLedger,
  addCategoryToLedger,
  appendTransactionToLedger,
  ledgerFromImportedTransactions,
  newTransactionFromForm,
  removeAccountFromLedger,
  removeCategoryFromLedger,
  setCarryForwardInLedger,
  softDeleteInLedger,
  updateTransactionInLedger,
  upsertBudgetInLedger
} from '../../../shared/ledgerStore';
import { clearLocalLedger, loadLocalLedger, saveLocalLedger } from '../localLedgerStore';

export type HomeView = 'calendar' | 'weekly' | 'monthly' | 'summary';
export type MainTab = 'trans' | 'stats' | 'accounts' | 'more';
export type LoadPhase = 'loading' | 'ready' | 'error';

const today = () => new Date().toISOString().slice(0, 10);

export const emptyForm = (): TransactionFormInput => ({
  date: today(),
  type: 'expense',
  amount: '',
  currency: 'INR',
  account: 'Cash',
  category: '',
  note: '',
  receiptUrl: ''
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function applySnapshot(snapshot: LedgerSnapshot) {
  return {
    transactions: [...snapshot.transactions].reverse(),
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    budgets: snapshot.budgets
  };
}

type LedgerContextValue = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  carryForward: boolean;
  busy: boolean;
  loadPhase: LoadPhase;
  message: string;
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
  saveBudget: (category: string, amount: string, currency: string) => Promise<void>;
  addAccount: (name: string, currency: string, openingBalance: string) => Promise<void>;
  deleteAccount: (name: string) => Promise<void>;
  addCategory: (name: string, type: TransactionType) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  setCarryForward: (value: boolean) => Promise<void>;
  exportCsv: () => Promise<void>;
  importCsv: () => Promise<void>;
  resetAllData: () => Promise<void>;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [carryForward, setCarryForwardState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading');
  const [message, setMessage] = useState('');
  const bootstrappedRef = useRef(false);
  const [mainTab, setMainTab] = useState<MainTab>('trans');
  const [homeView, setHomeView] = useState<HomeView>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<TransactionFilters>({ type: 'all' });
  const [form, setForm] = useState<TransactionFormInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const currentMonth = useMemo(() => monthKey(selectedMonth), [selectedMonth]);

  function syncFromSnapshot(next: LedgerSnapshot) {
    setSnapshot(next);
    const applied = applySnapshot(next);
    setTransactions(applied.transactions);
    setAccounts(applied.accounts);
    setCategories(applied.categories);
    setBudgets(applied.budgets);
    setCarryForwardState(next.settings?.carryForward ?? false);

    const defaultAccount = applied.accounts.find((account) => account.active)?.name ?? 'Cash';
    const defaultCategory =
      applied.categories.find((category) => category.active && category.type === 'expense')?.name ?? 'Food';

    setForm((current) => ({
      ...current,
      account: current.account || defaultAccount,
      category: current.category || defaultCategory
    }));
  }

  async function persist(next: LedgerSnapshot) {
    await saveLocalLedger(next);
    syncFromSnapshot(next);
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      try {
        const loaded = await loadLocalLedger();
        syncFromSnapshot(loaded);
        setLoadPhase('ready');
        setMessage('Data is stored on this device. Export CSV to back up or sync manually.');
      } catch (error) {
        setLoadPhase('error');
        setMessage(errorMessage(error));
      }
    })();
  }, []);

  async function refresh() {
    if (!snapshot) return;
    setBusy(true);
    try {
      const loaded = await loadLocalLedger();
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
        const existing = transactions.find((transaction) => transaction.id === editingId);
        if (!existing) throw new Error('Transaction no longer exists.');

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
        const transaction = newTransactionFromForm(form, 'mobile');
        const next = appendTransactionToLedger(snapshot, transaction);
        await persist(next);
        setForm((current) => ({
          ...emptyForm(),
          type: current.type,
          currency: current.currency,
          account: current.account,
          category: current.type === 'income' ? 'Salary' : current.category
        }));
        setShowAdd(false);
        setMessage('Transaction saved.');
      }
    } catch (error) {
      const text = errorMessage(error);
      setMessage(text);
      Alert.alert('Could not save transaction', text);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!snapshot) return;

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
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setShowAdd(false);
  }

  async function saveBudget(category: string, amountText: string, currency: string) {
    if (!snapshot) return;

    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid budget', 'Enter a valid amount.');
      return;
    }

    setBusy(true);
    try {
      const budget: Budget = { category, month: currentMonth, amount, currency };
      const next = upsertBudgetInLedger(snapshot, budget);
      await persist(next);
      setMessage(`Budget saved for ${category}.`);
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
      const text = errorMessage(error);
      setMessage(text);
      Alert.alert('Could not add account', text);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(name: string) {
    if (!snapshot) return;
    Alert.alert('Remove account', `Remove "${name}"? Existing transactions keep their data, but it will no longer be selectable.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
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
          })();
        }
      }
    ]);
  }

  async function addCategory(name: string, type: TransactionType) {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = addCategoryToLedger(snapshot, { name, type, active: true });
      await persist(next);
      setMessage(`Category "${name.trim()}" added.`);
    } catch (error) {
      const text = errorMessage(error);
      setMessage(text);
      Alert.alert('Could not add category', text);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(name: string) {
    if (!snapshot) return;
    Alert.alert('Remove category', `Remove "${name}"? Existing transactions keep their data, but it will no longer be selectable.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
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
          })();
        }
      }
    ]);
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

  async function exportCsv() {
    const { Share } = await import('react-native');
    const csv = exportTransactionsCsv(transactions);
    await Share.share({ message: csv, title: `money-sheets-${currentMonth}.csv` });
    setMessage('CSV ready to save or share.');
  }

  async function importCsv() {
    if (!snapshot) return;

    const DocumentPicker = await import('expo-document-picker');
    const FileSystem = await import('expo-file-system');

    const pick = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true
    });

    if (pick.canceled || !pick.assets?.[0]) return;

    const asset = pick.assets[0];
    const fileName = asset.name ?? 'import.csv';

    Alert.alert(
      'Replace all data?',
      `Import "${fileName}"?\n\nAll existing data on this device will be removed and replaced with transactions from the file. Budgets will also be reset.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const uri = asset.uri;
                const text = await FileSystem.readAsStringAsync(uri);
                const imported = parseTransactionsCsv(text);
                const next = ledgerFromImportedTransactions(imported);
                await persist(next);
                setForm(emptyForm());
                setEditingId(null);
                setShowAdd(false);
                setMessage(`Imported ${imported.length} transactions. Previous data was replaced.`);
              } catch (error) {
                const text = errorMessage(error);
                setMessage(text);
                Alert.alert('Import failed', text);
              } finally {
                setBusy(false);
              }
            })();
          }
        }
      ]
    );
  }

  async function resetAllData() {
    Alert.alert(
      'Erase all data?',
      'This removes transactions, budgets, and custom accounts/categories from this device. Export a CSV first if you need a backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const fresh = await clearLocalLedger();
                syncFromSnapshot(fresh);
                setForm(emptyForm());
                setEditingId(null);
                setShowAdd(false);
                setMessage('All local data was cleared.');
              } catch (error) {
                setMessage(errorMessage(error));
              } finally {
                setBusy(false);
              }
            })();
          }
        }
      ]
    );
  }

  const value: LedgerContextValue = {
    transactions,
    accounts,
    categories,
    budgets,
    carryForward,
    busy,
    loadPhase,
    message,
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
    deleteAccount,
    addCategory,
    deleteCategory,
    setCarryForward,
    exportCsv,
    importCsv,
    resetAllData
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('useLedger must be used within LedgerProvider');
  return context;
}
