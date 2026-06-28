import { useEffect, useRef, useState } from 'react';
import { PwaShell } from './components/PwaShell';
import {
  LedgerProvider,
  useLedger,
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
  filterTransactions,
  type HomeView,
  type TrendGranularity
} from './ledger';
import type { Account, AccountBalance, Category, Transaction, TransactionType } from '../../shared/finance';
import { NAV as SHARED_NAV, TAB_TITLES } from '../../shared/nav';
import type { StorageMode, StoragePreferences } from '../../shared/storage/types';
import { isTursoConfigComplete } from '../../shared/storage/prefs';
import { Calculator } from './Calculator';
import { ProgressOverlay } from './components/ProgressOverlay';
import { ExportOptionsModal } from './components/ExportOptionsModal';
import { SyncStatusBar } from './components/SyncStatusBar';
import { StorageReplaceModal } from './components/StorageReplaceModal';
import { SyncOtherDevicesPanel } from './components/syncDevices/SyncOtherDevicesPanel';
import { useTheme } from './theme';
import './styles.css';

const NAV = SHARED_NAV;
const TITLES: Record<string, string> = TAB_TITLES;

const HOME_VIEWS: Array<{ id: HomeView; label: string }> = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'summary', label: 'Summary' }
];

const SIDEBAR_COLLAPSED_KEY = 'money-sheets-sidebar-collapsed';

const todayKey = () => new Date().toISOString().slice(0, 10);

const EMOJI_CHOICES = [
  '🛒', '🍜', '🍔', '☕', '⛽', '🚌', '🚗', '✈️', '🏠', '🛠️', '👕', '🎁',
  '🩺', '💊', '🏥', '💸', '📄', '📒', '🎓', '🎮', '🎵', '⚽', '🐾', '🌿',
  '💡', '📱', '💳', '🍷', '🏋️', '💰', '💵', '🏦', '📦', '🧾', '📌', '🎯'
];

const COLOR_CHOICES = [
  '#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff', '#ff7a45',
  '#22c3e6', '#f2495c', '#7ed957', '#c44dff', '#34d399', '#fbbf24'
];

export default function App() {
  return (
    <LedgerProvider>
      <AppShell />
    </LedgerProvider>
  );
}

function AppShell() {
  const ledger = useLedger();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  );

  // Reset scroll to the top of the page whenever the user switches sections.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [ledger.mainTab]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  if (ledger.loadPhase === 'loading') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="brand-mark large">₹</span>
          <h1>Loading your money…</h1>
          <div className="auth-spinner" aria-hidden />
        </div>
      </main>
    );
  }

  if (ledger.loadPhase === 'error') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="brand-mark large">₹</span>
          <h1>Could not load data</h1>
          <p className="status error">{ledger.message}</p>
          <button className="primary" onClick={() => void ledger.refresh()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className="main">
        {ledger.showcaseMode ? (
          <div className="showcase-banner">
            <span>🎬 Showcase mode — demo data only. Import a file or erase data to return to your own ledger.</span>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-lead">
            <h1>{TITLES[ledger.mainTab] ?? 'Transactions'}</h1>
            {ledger.message ? (
              <p className="status" title={ledger.message}>
                {ledger.busy ? <span className="auth-spinner" style={{ width: 12, height: 12, margin: 0, borderWidth: 2 }} /> : null}
                <span className="status-text">{ledger.message}</span>
              </p>
            ) : null}
          </div>
          <MonthNav />
          <div className="topbar-actions">
            <SyncStatusBar compact />
            <ThemeToggle />
            <button className="fab" onClick={() => { ledger.cancelEdit(); ledger.setShowAdd(true); }} aria-label="Add record">
              <span className="plus">+</span> <span className="fab-text">Add record</span>
            </button>
          </div>
        </header>

        <div className="content">
          {ledger.mainTab === 'trans' ? <TransView /> : null}
          {ledger.mainTab === 'stats' ? <StatsView /> : null}
          {ledger.mainTab === 'categories' ? <CategoriesView /> : null}
          {ledger.mainTab === 'accounts' ? <AccountsView /> : null}
          {ledger.mainTab === 'more' ? <MoreView /> : null}

          <footer className="app-footer">
            <span>Money Sheets · Released under the MIT License.</span>
            <span>Author: Dushyant Sharma</span>
          </footer>
        </div>
      </div>

      <MobileTabBar />

      {ledger.showAdd ? <AddModal /> : null}
      {ledger.exportPrompt ? (
        <ExportOptionsModal
          onChoose={(destination) => void ledger.exportData(destination)}
          onCancel={() => ledger.cancelExport()}
        />
      ) : null}
      {ledger.importProgress !== null ? (
        <ProgressOverlay
          value={ledger.importProgress}
          title="Importing your data…"
          subtitle="Hang tight while we read and parse the file."
        />
      ) : null}
      {ledger.exportProgress !== null ? (
        <ProgressOverlay
          value={ledger.exportProgress}
          title="Exporting your workbook…"
          subtitle="Building the monthly sheets and summary."
        />
      ) : null}
      {ledger.conflict ? (
        <SyncConflictModal
          local={ledger.conflict.local}
          remote={ledger.conflict.remote}
          busy={ledger.busy}
          onChoose={(choice) => void ledger.resolveConflict(choice)}
        />
      ) : null}
      <ConfirmDialog />
      <PwaShell />
    </div>
  );
}

function SyncConflictModal({
  local,
  remote,
  busy,
  onChoose
}: {
  local: { transactions: unknown[]; updatedAt: string };
  remote: { transactions: unknown[]; updatedAt: string };
  busy: boolean;
  onChoose: (choice: 'local' | 'turso') => void;
}) {
  const when = (iso: string) => (iso ? new Date(iso).toLocaleString() : 'unknown');
  return (
    <div className="modal-backdrop">
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon warn">🔄</div>
        <h3 style={{ margin: 0 }}>Both copies have data</h3>
        <p className="muted confirm-text">
          This device and your Turso database both contain transactions. Choose which copy to keep —
          the other will be overwritten. This cannot be undone.
        </p>
        <div className="sync-conflict-grid">
          <div className="sync-conflict-option">
            <strong>This device</strong>
            <span className="muted">{local.transactions.length} transactions</span>
            <span className="muted">Updated {when(local.updatedAt)}</span>
          </div>
          <div className="sync-conflict-option">
            <strong>Turso</strong>
            <span className="muted">{remote.transactions.length} transactions</span>
            <span className="muted">Updated {when(remote.updatedAt)}</span>
          </div>
        </div>
        <div className="confirm-actions">
          <button className="ghost" disabled={busy} onClick={() => onChoose('local')}>
            Use this device
          </button>
          <button className="primary" disabled={busy} onClick={() => onChoose('turso')}>
            Use Turso
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileTabBar() {
  const ledger = useLedger();
  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {NAV.map((item) => (
        <button
          key={item.id}
          className={ledger.mainTab === item.id ? 'tab active' : 'tab'}
          onClick={() => ledger.setMainTab(item.id)}
          aria-current={ledger.mainTab === item.id ? 'page' : undefined}
          style={{ ['--ico-tint' as string]: item.tint }}
        >
          <span className="tab-ico">{item.icon}</span>
          <span className="tab-label">{item.shortLabel ?? item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-ico sun">☀️</span>
        <span className="theme-toggle-ico moon">🌙</span>
        <span className="theme-toggle-knob" />
      </span>
    </button>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ledger = useLedger();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <span className="brand-mark">₹</span>
        <div className="brand-text">
          <strong>Money Sheets</strong>
          <span>Personal finance</span>
        </div>
      </div>

      <div className="sidebar-section">
        <span className="nav-label">Menu</span>
        <nav className="side-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={ledger.mainTab === item.id ? 'side-link active' : 'side-link'}
              onClick={() => ledger.setMainTab(item.id)}
              style={{ ['--ico-tint' as string]: item.tint }}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-ico">{item.icon}</span>
              <span className="side-link-text">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-section sidebar-spacer">
        <span className="nav-label">Data</span>
        <div className="sidebar-actions">
          <button className="side-link" onClick={() => void ledger.refresh()} title={collapsed ? 'Refresh' : undefined}>
            <span className="ico">↻</span> <span className="side-link-text">Refresh</span>
          </button>
          <button className="side-link" onClick={() => ledger.beginExport()} title={collapsed ? 'Export Excel' : undefined}>
            <span className="ico">⬇</span> <span className="side-link-text">Export Excel</span>
          </button>
          <ImportButton collapsed={collapsed} />
          <button className="side-link danger" onClick={() => void ledger.resetAllData()} title={collapsed ? 'Erase all data' : undefined}>
            <span className="ico">🗑</span> <span className="side-link-text">Erase all data</span>
          </button>
        </div>
      </div>

      <SyncStatusBar />

      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="sidebar-toggle-ico">{collapsed ? '»' : '«'}</span>
        <span className="side-link-text">Collapse</span>
      </button>
    </aside>
  );
}

function ImportButton({ asCard = false, collapsed = false }: { asCard?: boolean; collapsed?: boolean }) {
  const { importData } = useLedger();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importData(file);
        }}
      />
      {asCard ? (
        <button className="action-card" onClick={() => inputRef.current?.click()}>
          <span className="ac-ico">⬆️</span>
          <strong>Import CSV / Excel</strong>
          <span>Replace all data with a CSV or Excel backup (you'll confirm first).</span>
        </button>
      ) : (
        <button
          className="side-link"
          onClick={() => inputRef.current?.click()}
          title={collapsed ? 'Import CSV / Excel' : undefined}
        >
          <span className="ico">⬆</span> <span className="side-link-text">Import CSV / Excel</span>
        </button>
      )}
    </>
  );
}

function MonthNav() {
  const { selectedMonth, setSelectedMonth } = useLedger();
  return (
    <div className="month-nav">
      <button className="nav-btn" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}>‹</button>
      <strong>{monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}</strong>
      <button className="nav-btn" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}>›</button>
    </div>
  );
}

function DatePickerField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    if (open) {
      const p = value ? new Date(`${value}T12:00:00`) : new Date();
      setViewYear(p.getFullYear());
      setViewMonth(p.getMonth());
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const days = buildCalendarMonth([], viewYear, viewMonth);
  const label = parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <div className={`date-field ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="date-field-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="date-field-icon" aria-hidden>📅</span>
        <span className="date-field-text">{label}</span>
        <span className="date-field-caret">▾</span>
      </button>
      {open ? (
        <div className="date-pop">
          <div className="date-pop-head">
            <button type="button" className="nav-btn sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <strong>{monthTitle(viewYear, viewMonth)}</strong>
            <button type="button" className="nav-btn sm" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="calendar-weekdays compact">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}${i}`}>{d}</span>)}
          </div>
          <div className="calendar-grid compact">
            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`calendar-cell btn ${day.date === value ? 'selected' : ''} ${day.inMonth ? '' : 'muted'} ${day.date === todayKey() ? 'today' : ''}`}
                onClick={() => { onChange(day.date); setOpen(false); }}
              >
                <strong>{day.day}</strong>
              </button>
            ))}
          </div>
          <div className="date-pop-foot">
            <button type="button" className="link accent" onClick={() => { onChange(todayKey()); setOpen(false); }}>Today</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayTransactionsModal({
  date,
  transactions,
  onClose,
  startEdit,
  deleteTransaction
}: {
  date: string;
  transactions: Transaction[];
  onClose: () => void;
  startEdit: (t: Transaction) => void;
  deleteTransaction: (t: Transaction) => void;
}) {
  const { addTransactionOn } = useLedger();
  const rows = transactions.filter((t) => !t.deleted && t.date === date).sort((a, b) => b.amount - a.amount);
  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const parsed = new Date(`${date}T12:00:00`);
  const title = parsed.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const addOnThisDay = () => {
    addTransactionOn(date);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal day-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <button className="link" onClick={onClose}>Close</button>
          <strong>{title}</strong>
          <span />
        </header>
        <div className="day-modal-summary">
          <span className="income">+{formatMoney(income)}</span>
          <span className="expense">-{formatMoney(expense)}</span>
          <span className="balance">{formatMoney(income - expense)} net</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty"><span className="muted">No transactions on this day.</span></div>
        ) : (
          <div className="day-modal-list">
            {rows.map((txn) => {
              const meta = getCategoryMeta(txn.category);
              return (
                <article className="txn-row" key={txn.id}>
                  <span className="cat-icon" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>{meta.emoji}</span>
                  <div className="txn-body">
                    <strong>{txn.category}</strong>
                    <span>{txn.account}{txn.note ? ` · ${txn.note}` : ''}</span>
                  </div>
                  <div className="txn-end">
                    <em className={txn.type}>{formatSignedMoney(txn.amount, txn.type, txn.currency)}</em>
                    <div className="txn-actions">
                      <button className="icon-btn tip" data-tip="Edit" aria-label="Edit record" onClick={() => { startEdit(txn); onClose(); }}>✏️</button>
                      <button className="icon-btn tip danger" data-tip="Delete record" aria-label="Delete record" onClick={() => void deleteTransaction(txn)}>🗑</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <button type="button" className="primary day-add-btn" onClick={addOnThisDay}>
          + Add transaction
        </button>
      </div>
    </div>
  );
}

function SummaryStrip({ income, expense, balance, count, note }: { income: number; expense: number; balance: number; count: number; note?: string }) {
  return (
    <div className="summary-strip">
      <div className="summary-tile income">
        <div className="tile-top"><span>Income</span><span className="tile-ico">▲</span></div>
        <strong>{formatMoney(income)}</strong>
      </div>
      <div className="summary-tile expense">
        <div className="tile-top"><span>Expense</span><span className="tile-ico">▼</span></div>
        <strong>{formatMoney(expense)}</strong>
      </div>
      <div className="summary-tile balance">
        <div className="tile-top"><span>Balance</span><span className="tile-ico">＝</span></div>
        <strong>{formatMoney(balance)}</strong>
        <small>{note ?? `${count} transaction${count === 1 ? '' : 's'}`}</small>
      </div>
    </div>
  );
}

function TransView() {
  const {
    transactions,
    accounts,
    carryForward,
    filters,
    homeView,
    selectedMonth,
    setHomeView,
    setFilters,
    startEdit,
    deleteTransaction
  } = useLedger();

  const [dayPopup, setDayPopup] = useState<string | null>(null);

  const month = monthKey(selectedMonth);
  const monthSummary = summarizeMonth(transactions, month);
  const weekSummary = summarizeWeek(transactions);
  const monthTransactions = transactionsInMonth(transactions, month);
  const filtered = filterTransactions(monthTransactions, filters);
  const groups = groupTransactionsByDate(filtered);
  const calendarDays = buildCalendarMonth(transactions, selectedMonth.getFullYear(), selectedMonth.getMonth());
  const expenseBreakdown = summarizeByCategory(transactions, month, 'expense');

  const broughtForward = carryForward ? carryOverBalance(accounts, transactions, month, true) : 0;
  const monthBalance = monthSummary.balance + broughtForward;
  const summary = homeView === 'weekly' ? weekSummary : monthSummary;
  const displayBalance = homeView === 'weekly' ? weekSummary.balance : monthBalance;
  const today = todayKey();

  return (
    <div className="stack">
      <div className="view-bar">
        <div className="pill-row">
          {HOME_VIEWS.map((view) => (
            <button
              key={view.id}
              className={homeView === view.id ? 'pill active' : 'pill'}
              onClick={() => setHomeView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <SummaryStrip
        income={summary.income}
        expense={summary.expense}
        balance={displayBalance}
        count={summary.count}
        note={carryForward && homeView !== 'weekly' ? `Incl. ${formatMoney(broughtForward)} brought forward` : undefined}
      />

      <div className="split">
        <div className="panel">
          {homeView === 'calendar' ? (
            <>
              <h3>Calendar</h3>
              <div className="calendar-weekdays">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}${i}`}>{d}</span>)}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`calendar-cell btn ${day.inMonth ? '' : 'muted'} ${day.count ? 'has-data' : ''} ${day.date === today ? 'today' : ''}`}
                    onClick={() => setDayPopup(day.date)}
                    title={day.count ? `${day.count} transaction${day.count === 1 ? '' : 's'}` : 'View day'}
                  >
                    <strong>{day.day}</strong>
                    {day.expense > 0 ? <em className="expense">-{day.expense.toFixed(0)}</em> : null}
                    {day.income > 0 ? <em className="income">+{day.income.toFixed(0)}</em> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {homeView === 'summary' ? (
            <>
              <h3>Top spending</h3>
              {expenseBreakdown.length === 0 ? (
                <p className="muted">No expenses yet.</p>
              ) : (
                <ul className="mini-list">
                  {expenseBreakdown.slice(0, 6).map((row) => (
                    <li key={row.category}>
                      <span>{getCategoryMeta(row.category).emoji} {row.category}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>

        <div className="trans-right">
        <div className="panel filter-panel">
          <h3>Filters</h3>
          <div className="filter-grid">
            <select value={filters.type ?? 'all'} onChange={(e) => setFilters({ ...filters, type: e.target.value as typeof filters.type })}>
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input placeholder="Search…" value={filters.search ?? ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </div>

        <div className="panel list-panel">
          <h3>Records</h3>
          {groups.length === 0 ? (
            <div className="empty">
              <span className="emoji">🧾</span>
              <strong>No transactions yet</strong>
              <span className="muted">Tap “Add record” to log your first entry.</span>
            </div>
          ) : null}
          {groups.map((group) => {
            const net = group.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <section key={group.date} className="txn-group">
                <div className="txn-group-head">
                  <div className="txn-date">
                    <span className="txn-day">{group.parts.day}</span>
                    <div className="txn-date-meta">
                      <strong>{group.parts.relative ?? group.parts.weekday}</strong>
                      <span>{group.parts.relative ? `${group.parts.weekday} · ${group.parts.dateText}` : group.parts.dateText}</span>
                    </div>
                  </div>
                  <span className="day-net">{net >= 0 ? '+' : '-'}{formatMoney(Math.abs(net))}</span>
                </div>
                {group.items.map((txn) => {
                  const meta = getCategoryMeta(txn.category);
                  return (
                    <article className="txn-row" key={txn.id}>
                      <span className="cat-icon" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>{meta.emoji}</span>
                      <div className="txn-body">
                        <strong>{txn.category}</strong>
                        <span>{txn.account}{txn.note ? ` · ${txn.note}` : ''}</span>
                      </div>
                      <div className="txn-end">
                        <em className={txn.type}>{formatSignedMoney(txn.amount, txn.type, txn.currency)}</em>
                        <div className="txn-actions">
                          <button className="icon-btn tip" data-tip="Edit" aria-label="Edit record" onClick={() => startEdit(txn)}>✏️</button>
                          <button className="icon-btn tip danger" data-tip="Delete record" aria-label="Delete record" onClick={() => void deleteTransaction(txn)}>🗑</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
        </div>
      </div>

      {dayPopup ? (
        <DayTransactionsModal
          date={dayPopup}
          transactions={transactions}
          onClose={() => setDayPopup(null)}
          startEdit={startEdit}
          deleteTransaction={deleteTransaction}
        />
      ) : null}
    </div>
  );
}

type ColoredRow = { category: string; amount: number; percent: number; color: string };

function truncate(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function RingChart({
  data,
  total,
  caption,
  activeCategory,
  onSelect
}: {
  data: ColoredRow[];
  total: number;
  caption: string;
  activeCategory: string | null;
  onSelect: (category: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const size = 240;
  const thickness = 24;
  const labelPad = 18;
  const arcs = categoryRingArcs(data, { size, thickness, gapDeg: 5, labelPad, colors: data.map((d) => d.color) });
  const trackR = (size - thickness) / 2 - labelPad;

  const focusCat = hover ?? activeCategory;
  const focusRow = focusCat ? data.find((row) => row.category === focusCat) ?? null : null;
  const focusMeta = focusRow ? getCategoryMeta(focusRow.category) : null;

  const opacityFor = (category: string) => {
    if (hover) return hover === category ? 1 : 0.26;
    if (activeCategory) return activeCategory === category ? 1 : 0.26;
    return 1;
  };

  const hoveredArc = hover ? arcs.find((arc) => arc.category === hover) ?? null : null;
  const tipW = 134;
  const tipH = 46;
  const tipCx = hoveredArc ? Math.min(Math.max(hoveredArc.labelX, tipW / 2 + 2), size - tipW / 2 - 2) : 0;
  const tipTop = hoveredArc ? (hoveredArc.labelY > size / 2 ? hoveredArc.labelY - tipH - 14 : hoveredArc.labelY + 14) : 0;

  return (
    <div className="ring">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${caption} by category`}>
        <circle cx={size / 2} cy={size / 2} r={trackR} fill="none" stroke="var(--ring-track)" strokeWidth={thickness} />
        {arcs.map((arc) => {
          const handlers = {
            stroke: arc.color,
            strokeWidth: thickness,
            opacity: opacityFor(arc.category),
            style: { cursor: 'pointer', transition: 'opacity .15s ease' } as React.CSSProperties,
            onMouseEnter: () => setHover(arc.category),
            onMouseLeave: () => setHover((current) => (current === arc.category ? null : current)),
            onClick: () => onSelect(arc.category)
          };
          return arc.full ? (
            <circle key={arc.category} cx={size / 2} cy={size / 2} r={trackR} fill="none" {...handlers} />
          ) : (
            <path key={arc.category} d={arc.path} fill="none" strokeLinecap="round" {...handlers} />
          );
        })}
        {arcs
          .filter((arc) => arc.showLabel)
          .map((arc) => (
            <g key={`lbl-${arc.category}`} className="ring-pill" pointerEvents="none" opacity={opacityFor(arc.category)}>
              <rect x={arc.labelX - 16} y={arc.labelY - 10} width={32} height={20} rx={10} fill="var(--pill-bg)" stroke="var(--pill-border)" />
              <text x={arc.labelX} y={arc.labelY + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">
                {arc.percent.toFixed(0)}%
              </text>
            </g>
          ))}
        {hoveredArc && focusRow ? (
          <g pointerEvents="none" className="ring-tip">
            <rect x={tipCx - tipW / 2} y={tipTop} width={tipW} height={tipH} rx={10} fill="var(--card)" stroke="var(--border)" />
            <text x={tipCx} y={tipTop + 18} textAnchor="middle" fontSize="10" fill="var(--text-dim)">
              {focusMeta?.emoji} {truncate(focusRow.category)}
            </text>
            <text x={tipCx} y={tipTop + 35} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">
              {formatMoney(focusRow.amount)} · {focusRow.percent.toFixed(0)}%
            </text>
          </g>
        ) : null}
      </svg>
      <div className="ring-center">
        {focusRow ? (
          <>
            <span>{focusMeta?.emoji} {truncate(focusRow.category)}</span>
            <strong>{formatMoney(focusRow.amount)}</strong>
            <small>{focusRow.percent.toFixed(0)}% of {caption.toLowerCase()}</small>
          </>
        ) : (
          <>
            <span>{caption}</span>
            <strong>{formatMoney(total)}</strong>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryGrid({
  data,
  activeCategory,
  onSelect,
  onViewDetails
}: {
  data: ColoredRow[];
  activeCategory: string | null;
  onSelect: (category: string) => void;
  onViewDetails: (category: string) => void;
}) {
  return (
    <div className="cat-grid">
      {data.map((row) => {
        const meta = getCategoryMeta(row.category);
        const isActive = activeCategory === row.category;
        const dimmed = activeCategory !== null && !isActive;
        return (
          <div
            role="button"
            tabIndex={0}
            className={`cat-tile ${isActive ? 'active' : ''} ${dimmed ? 'off' : ''}`}
            key={row.category}
            onClick={() => onSelect(row.category)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(row.category);
              }
            }}
            aria-pressed={isActive}
            title={isActive ? 'Clear highlight' : 'Highlight in chart'}
            style={{ '--tile-accent': row.color } as React.CSSProperties}
          >
            <span className="cat-rail" style={{ backgroundColor: row.color }} />
            <div className="cat-tile-head">
              <span className="cat-chip" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                {meta.emoji}
              </span>
              <div className="cat-tile-info">
                <strong>{formatMoney(row.amount)}</strong>
                <span>{row.category}</span>
              </div>
              <span className="cat-pct">{row.percent.toFixed(0)}%</span>
            </div>
            <div className="cat-tile-bar">
              <span style={{ width: `${Math.min(row.percent, 100)}%`, backgroundColor: row.color }} />
            </div>
            <button
              type="button"
              className="cat-tile-link"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(row.category);
              }}
            >
              View details
            </button>
          </div>
        );
      })}
    </div>
  );
}

const TREND_RANGES: Array<{ id: TrendGranularity; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' }
];

type HoverPoint = { x: number; y: number; label: string; category: string; color: string; value: number };

function LineChart({
  labels,
  series
}: {
  labels: string[];
  series: Array<{ category: string; points: number[]; color: string }>;
}) {
  const [hover, setHover] = useState<HoverPoint | null>(null);

  const width = 340;
  const height = 200;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 28;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const rawMax = Math.max(1, ...series.flatMap((line) => line.points));
  const max = niceCeil(rawMax);
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const rows = [0, 0.25, 0.5, 0.75, 1];
  const showArea = series.length === 1;

  const x = (i: number) => padLeft + stepX * i;
  const y = (value: number) => padTop + innerH - (value / max) * innerH;

  const tipW = 104;
  const tipH = 40;
  const tipX = hover ? Math.min(Math.max(hover.x - tipW / 2, 2), width - tipW - 2) : 0;
  const tipY = hover ? (hover.y - tipH - 12 < 0 ? hover.y + 14 : hover.y - tipH - 12) : 0;
  const shortCat = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Category trend">
      {showArea ? (
        <defs>
          <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}

      {rows.map((g) => (
        <g key={g}>
          <line x1={padLeft} x2={width - padRight} y1={padTop + innerH * g} y2={padTop + innerH * g} stroke="var(--chart-grid)" strokeWidth={1} />
          <text x={padLeft - 8} y={padTop + innerH * g + 3} textAnchor="end" fontSize="9" fill="var(--text-dim)">
            {formatAxisMoney(max * (1 - g))}
          </text>
        </g>
      ))}

      {hover ? <line x1={hover.x} x2={hover.x} y1={padTop} y2={padTop + innerH} stroke="var(--chart-grid)" strokeWidth={1} /> : null}

      {series.map((line) => {
        const linePath = line.points
          .map((value, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(value).toFixed(1)}`)
          .join(' ');
        const areaPath = `${linePath} L ${x(line.points.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;
        return (
          <g key={line.category}>
            {showArea ? <path d={areaPath} fill="url(#trend-area)" stroke="none" /> : null}
            <path d={linePath} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {line.points.map((value, i) => (
              <circle key={i} cx={x(i)} cy={y(value)} r={2.6} fill={line.color} stroke="var(--card)" strokeWidth={1} />
            ))}
          </g>
        );
      })}

      {/* Transparent hit targets for hover tooltips */}
      {series.map((line) =>
        line.points.map((value, i) => (
          <circle
            key={`hit-${line.category}-${i}`}
            cx={x(i)}
            cy={y(value)}
            r={10}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover({ x: x(i), y: y(value), label: labels[i], category: line.category, color: line.color, value })}
            onMouseLeave={() => setHover((current) => (current?.category === line.category && current?.label === labels[i] ? null : current))}
          />
        ))
      )}

      {labels.map((label, i) => (
        <text key={label + i} x={x(i)} y={height - 9} textAnchor="middle" fontSize="9" fill="var(--text-dim)">
          {label}
        </text>
      ))}

      {hover ? (
        <g pointerEvents="none">
          <circle cx={hover.x} cy={hover.y} r={4.5} fill={hover.color} stroke="var(--card)" strokeWidth={1.5} />
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={9} fill="var(--card)" stroke="var(--border)" />
          <circle cx={tipX + 11} cy={tipY + 14} r={4} fill={hover.color} />
          <text x={tipX + 20} y={tipY + 17} fontSize="9" fill="var(--text-dim)">
            {hover.label} · {shortCat(hover.category)}
          </text>
          <text x={tipX + 11} y={tipY + 31} fontSize="12" fontWeight="700" fill="var(--text)">
            {formatMoney(hover.value)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function StatsBreakdown({ type }: { type: TransactionType }) {
  const { transactions, selectedMonth, focusCategory } = useLedger();
  const [active, setActive] = useState<string | null>(null);
  const month = monthKey(selectedMonth);
  const breakdown = summarizeByCategory(transactions, month, type);

  if (breakdown.length === 0) {
    return <div className="empty"><span className="emoji">📊</span><span className="muted">No {type} data this month.</span></div>;
  }

  const tiles: ColoredRow[] = breakdown.map((row, index) => ({ ...row, color: chartColorAt(index) }));
  const total = tiles.reduce((sum, row) => sum + row.amount, 0);
  // Keep highlight valid when the month/type changes underneath us.
  const activeCategory = active && tiles.some((row) => row.category === active) ? active : null;

  const select = (category: string) => setActive((current) => (current === category ? null : category));

  return (
    <div className="breakdown-layout">
      <div className="ring-hero">
        <RingChart
          data={tiles}
          total={total}
          caption={type === 'expense' ? 'Spent' : 'Earned'}
          activeCategory={activeCategory}
          onSelect={select}
        />
      </div>
      <div className="breakdown-cats">
        <h4 className="section-title">
          {type === 'expense' ? 'Spending' : 'Income'} categories <span className="muted">· tap to highlight</span>
        </h4>
        <CategoryGrid
          data={tiles}
          activeCategory={activeCategory}
          onSelect={select}
          onViewDetails={focusCategory}
        />
      </div>
    </div>
  );
}

function StatsTrends({ type }: { type: TransactionType }) {
  const { transactions, selectedMonth } = useLedger();
  const [granularity, setGranularity] = useState<TrendGranularity>('month');
  // Empty selection = show every category. Selecting categories isolates them.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const trends = buildCategoryTrends(transactions, { granularity, type, topN: 6, endDate: selectedMonth });

  const colored = trends.categories.map((cat, index) => ({
    ...cat,
    color: chartColorAt(index)
  }));
  const isShown = (category: string) => selected.size === 0 || selected.has(category);
  const series = colored
    .filter((cat) => isShown(cat.category))
    .map((cat) => ({ category: cat.category, points: cat.points, color: cat.color }));

  function toggle(category: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const focusNote = selected.size > 0 ? ` · showing ${selected.size} selected` : ' · tap a category to isolate';

  return (
    <div className="trends-layout">
      <div className="segmented small">
        {TREND_RANGES.map((range) => (
          <button
            key={range.id}
            className={granularity === range.id ? 'seg active' : 'seg'}
            onClick={() => setGranularity(range.id)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {colored.length === 0 ? (
        <div className="empty"><span className="emoji">📈</span><span className="muted">Not enough {type} history to chart trends yet.</span></div>
      ) : (
        <>
          <p className="trend-sub muted">
            {type === 'expense' ? 'Spending' : 'Income'} per {granularity}{focusNote}.
          </p>
          <div className="trend-chart">
            <LineChart labels={trends.labels} series={series} />
          </div>
          <ul className="trend-legend">
            {colored.map((cat) => {
              const meta = getCategoryMeta(cat.category);
              const last = cat.points[cat.points.length - 1] ?? 0;
              const prev = cat.points[cat.points.length - 2] ?? 0;
              const delta = last - prev;
              const shown = isShown(cat.category);
              const picked = selected.has(cat.category);
              // For expense, more spending (delta > 0) is "bad" (red ▲); for income it's "good".
              const deltaTone = delta === 0 ? '' : type === 'expense' ? (delta > 0 ? 'up' : 'down') : delta > 0 ? 'down' : 'up';
              return (
                <li key={cat.category}>
                  <button
                    type="button"
                    className={`trend-legend-btn ${shown ? '' : 'off'} ${picked ? 'picked' : ''}`}
                    onClick={() => toggle(cat.category)}
                    aria-pressed={picked}
                  >
                    <span className="trend-dot" style={{ backgroundColor: shown ? cat.color : 'var(--border)' }} />
                    <span className="trend-name">{meta.emoji} {cat.category}</span>
                    <strong>{formatMoney(last)}</strong>
                    {prev > 0 || last > 0 ? (
                      <span className={`trend-delta ${deltaTone}`}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {formatMoney(Math.abs(delta))}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function pctDelta(curr: number, prev: number) {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function StatsKpis() {
  const { transactions, selectedMonth } = useLedger();
  const curr = summarizeMonth(transactions, monthKey(selectedMonth));
  const prev = summarizeMonth(transactions, monthKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)));
  const savings = curr.income > 0 ? (curr.balance / curr.income) * 100 : 0;
  const prevSavings = prev.income > 0 ? (prev.balance / prev.income) * 100 : 0;

  const cards = [
    { label: 'Income', value: formatMoney(curr.income), icon: '💰', tint: '#22c08b', delta: pctDelta(curr.income, prev.income), goodWhenUp: true, points: false },
    { label: 'Expense', value: formatMoney(curr.expense), icon: '💸', tint: '#ff5d8f', delta: pctDelta(curr.expense, prev.expense), goodWhenUp: false, points: false },
    { label: 'Net balance', value: formatMoney(curr.balance), icon: '⚖️', tint: '#4f7cff', delta: pctDelta(curr.balance, prev.balance), goodWhenUp: true, points: false },
    { label: 'Savings rate', value: `${savings.toFixed(0)}%`, icon: '🪙', tint: '#9b6bff', delta: savings - prevSavings, goodWhenUp: true, points: true }
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => {
        const flat = Math.abs(c.delta) < 0.05;
        const up = c.delta > 0;
        const good = flat ? null : up === c.goodWhenUp;
        return (
          <div className="kpi-card" key={c.label} style={{ ['--ico-tint' as string]: c.tint }}>
            <div className="kpi-top">
              <span>{c.label}</span>
              <span className="kpi-ico">{c.icon}</span>
            </div>
            <strong>{c.value}</strong>
            <span className={`kpi-delta ${flat ? '' : good ? 'good' : 'bad'}`}>
              {flat ? '—' : up ? '▲' : '▼'} {Math.abs(c.delta).toFixed(c.points ? 1 : 0)}{c.points ? ' pts' : '%'}
              <span className="kpi-delta-note"> vs last month</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatsView() {
  const { transactions, selectedMonth } = useLedger();
  const [tab, setTab] = useState<'breakdown' | 'trends'>('breakdown');
  const [type, setType] = useState<TransactionType>('expense');
  const month = monthKey(selectedMonth);
  const summary = summarizeMonth(transactions, month);

  return (
    <div className="stack">
      <div className="view-bar">
        <div className="segmented">
          <button className={tab === 'breakdown' ? 'seg active' : 'seg'} onClick={() => setTab('breakdown')}>Breakdown</button>
          <button className={tab === 'trends' ? 'seg active' : 'seg'} onClick={() => setTab('trends')}>Trends</button>
        </div>
      </div>

      <StatsKpis />

      <div className="panel stats-panel">
        <div className="stats-tabs">
          <button className={type === 'income' ? 'stats-tab active' : 'stats-tab'} onClick={() => setType('income')}>
            <span>Income</span>
            <strong className="income">{formatMoney(summary.income)}</strong>
          </button>
          <button className={type === 'expense' ? 'stats-tab active' : 'stats-tab'} onClick={() => setType('expense')}>
            <span>Expenses</span>
            <strong className="expense">{formatMoney(summary.expense)}</strong>
          </button>
        </div>

        {tab === 'breakdown' ? <StatsBreakdown type={type} /> : <StatsTrends type={type} />}
      </div>
    </div>
  );
}

const ALL_CATEGORIES = '__all__';

function CategoryPicker({
  expenseCats,
  incomeCats,
  value,
  amounts,
  allTotal,
  onChange
}: {
  expenseCats: Category[];
  incomeCats: Category[];
  value: string;
  amounts: Map<string, number>;
  allTotal: number;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAll = value === ALL_CATEGORIES;
  const meta = getCategoryMeta(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const renderGroup = (label: string, cats: Category[]) =>
    cats.length === 0 ? null : (
      <div className="dd-group" key={label}>
        <span className="dd-group-label">{label}</span>
        {cats.map((c) => {
          const m = getCategoryMeta(c.name);
          const amt = amounts.get(c.name) ?? 0;
          return (
            <button
              key={c.name}
              type="button"
              className={`dd-item ${c.name === value ? 'on' : ''}`}
              onClick={() => { onChange(c.name); setOpen(false); }}
            >
              <span className="dd-emoji" style={{ backgroundColor: `${m.color}22`, color: m.color }}>{m.emoji}</span>
              <span className="dd-name">{c.name}</span>
              {amt > 0 ? <span className="dd-amt">{formatMoney(amt)}</span> : null}
            </button>
          );
        })}
      </div>
    );

  return (
    <div className={`cat-dd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="cat-dd-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="dd-emoji" style={isAll ? { background: 'var(--accent-soft)' } : { backgroundColor: `${meta.color}22`, color: meta.color }}>
          {isAll ? '🗂️' : meta.emoji}
        </span>
        <span className="dd-current">{isAll ? 'All categories' : value || 'Select category'}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open ? (
        <div className="cat-dd-pop" role="listbox">
          <div className="dd-group">
            <button
              type="button"
              className={`dd-item ${isAll ? 'on' : ''}`}
              onClick={() => { onChange(ALL_CATEGORIES); setOpen(false); }}
            >
              <span className="dd-emoji" style={{ background: 'var(--accent-soft)' }}>🗂️</span>
              <span className="dd-name">All categories</span>
              {allTotal > 0 ? <span className="dd-amt">{formatMoney(allTotal)}</span> : null}
            </button>
          </div>
          {renderGroup('Expense', expenseCats)}
          {renderGroup('Income', incomeCats)}
        </div>
      ) : null}
    </div>
  );
}

function CategoryEditPanel({ category, onClose }: { category: Category; onClose: () => void }) {
  const { updateCategory } = useLedger();
  const meta = getCategoryMeta(category.name);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji ?? '');
  const [color, setColor] = useState(category.color ?? '');

  async function save() {
    if (!name.trim()) return;
    await updateCategory(category.name, { name, emoji, color });
    onClose();
  }

  return (
    <div className="panel">
      <div className="panel-head"><h3>Edit “{category.name}”</h3></div>
      <div className="chip-editor" style={{ border: 0, padding: 0, background: 'transparent' }}>
        <div className="chip-editor-top">
          <span className="chip-emoji big">{emoji || meta.emoji}</span>
          <input
            className="chip-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
            autoFocus
          />
        </div>
        <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
        <div className="chip-editor-actions">
          <button className="link" onClick={onClose}>Cancel</button>
          <button className="primary sm" onClick={() => void save()} disabled={!name.trim()}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function CategoriesView() {
  const { transactions, categories, selectedMonth, startEdit, deleteTransaction, categoryFocus, clearCategoryFocus } =
    useLedger();
  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);
  const [editing, setEditing] = useState(false);

  // Honor a "View details" jump from the Stats view, then consume it so manual
  // category changes here are not overridden.
  useEffect(() => {
    if (categoryFocus) {
      setSelected(categoryFocus);
      setEditing(false);
      clearCategoryFocus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [categoryFocus, clearCategoryFocus]);

  const month = monthKey(selectedMonth);
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');
  const names = [...expenseCats, ...incomeCats].map((c) => c.name);
  const isAll = selected === ALL_CATEGORIES;
  const current = isAll ? ALL_CATEGORIES : selected && names.includes(selected) ? selected : names[0] ?? '';
  const currentCat = isAll ? undefined : categories.find((c) => c.name === current);
  const meta = getCategoryMeta(current);

  const monthAll = transactionsInMonth(transactions, month).filter((t) => !t.deleted);
  const amounts = new Map<string, number>();
  for (const t of monthAll) amounts.set(t.category, (amounts.get(t.category) ?? 0) + t.amount);
  const allTotal = monthAll.reduce((sum, t) => sum + t.amount, 0);

  const monthRows = isAll ? monthAll : monthAll.filter((t) => t.category === current);
  const groups = groupTransactionsByDate(monthRows);
  const visible = groups.flatMap((g) => g.items);
  const total = visible.reduce((sum, t) => sum + t.amount, 0);
  const isExpense = currentCat?.type !== 'income';
  const heroEmoji = isAll ? '🗂️' : meta.emoji;
  const heroColor = isAll ? 'var(--accent)' : meta.color;
  const heroName = isAll ? 'All categories' : current || 'No categories';

  return (
    <div className="stack">
      <div className="view-bar">
        <div className="cat-toolbar">
          <CategoryPicker
            expenseCats={expenseCats}
            incomeCats={incomeCats}
            value={current}
            amounts={amounts}
            allTotal={allTotal}
            onChange={(name) => { setSelected(name); setEditing(false); }}
          />
          {currentCat ? (
            <button
              type="button"
              className={`pill ${editing ? 'active' : ''}`}
              onClick={() => setEditing((v) => !v)}
              title="Rename or change emoji"
            >
              ✏️ Edit
            </button>
          ) : null}
        </div>
      </div>

      {editing && currentCat ? (
        <CategoryEditPanel key={currentCat.name} category={currentCat} onClose={() => setEditing(false)} />
      ) : null}

      <div className="cat-hero" style={{ ['--cat-accent' as string]: heroColor }}>
        <span className="cat-hero-chip" style={{ backgroundColor: isAll ? 'var(--accent-soft)' : `${meta.color}22`, color: heroColor }}>{heroEmoji}</span>
        <div className="cat-hero-body">
          <span>{heroName} · {monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}</span>
          <strong className={isAll ? 'balance' : isExpense ? 'expense' : 'income'}>{formatMoney(total)}</strong>
          <small className="muted">{visible.length} transaction{visible.length === 1 ? '' : 's'} · use ‹ › to change month</small>
        </div>
      </div>

      <div className="panel list-panel compact">
        {visible.length === 0 ? (
          <div className="empty">
            <span className="emoji">🗂️</span>
            <strong>Nothing in {isAll ? 'any category' : current || 'this category'} this month</strong>
            <span className="muted">Switch months with ‹ › or pick another category above.</span>
          </div>
        ) : null}
        {groups.map((group) => {
          const groupTotal = group.items.reduce((sum, t) => sum + t.amount, 0);
          return (
            <section key={group.date} className="txn-group">
              <div className="txn-group-head">
                <div className="txn-date">
                  <span className="txn-day">{group.parts.day}</span>
                  <div className="txn-date-meta">
                    <strong>{group.parts.relative ?? group.parts.weekday}</strong>
                    <span>{group.parts.relative ? `${group.parts.weekday} · ${group.parts.dateText}` : group.parts.dateText}</span>
                  </div>
                </div>
                <span className="day-net">{formatMoney(groupTotal)}</span>
              </div>
              {group.items.map((txn) => {
                const rowMeta = getCategoryMeta(txn.category);
                return (
                  <article className="txn-row" key={txn.id}>
                    <span className="cat-icon" style={{ backgroundColor: `${rowMeta.color}22`, color: rowMeta.color }}>{rowMeta.emoji}</span>
                    <div className="txn-body">
                      <strong>{isAll ? txn.category : txn.note || txn.category}</strong>
                      <span>{txn.account}{txn.note ? ` · ${txn.note}` : ''}</span>
                    </div>
                    <div className="txn-end">
                      <em className={txn.type}>{formatSignedMoney(txn.amount, txn.type, txn.currency)}</em>
                      <div className="txn-actions">
                        <button className="icon-btn tip" data-tip="Edit" aria-label="Edit record" onClick={() => startEdit(txn)}>✏️</button>
                        <button className="icon-btn tip danger" data-tip="Delete record" aria-label="Delete record" onClick={() => void deleteTransaction(txn)}>🗑</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AccountStatCard({ account, balance }: { account: Account; balance: AccountBalance }) {
  const { updateAccount } = useLedger();
  const meta = getAccountMeta(account.name);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [emoji, setEmoji] = useState(account.emoji ?? '');
  const [color, setColor] = useState(account.color ?? '');
  const [currency, setCurrency] = useState(account.currency);
  const [opening, setOpening] = useState(String(account.openingBalance));

  function openEdit() {
    setName(account.name);
    setEmoji(account.emoji ?? '');
    setColor(account.color ?? '');
    setCurrency(account.currency);
    setOpening(String(account.openingBalance));
    setEditing(true);
  }

  async function save() {
    if (!name.trim()) return;
    await updateAccount(account.name, { name, emoji, color, currency, openingBalance: Number(opening) || 0 });
    setEditing(false);
  }

  if (editing) {
    return (
      <article className="account-card editing">
        <div className="chip-editor" style={{ border: 0, padding: 0, background: 'transparent' }}>
          <div className="chip-editor-top">
            <span className="chip-emoji big">{emoji || account.name.slice(0, 1).toUpperCase()}</span>
            <input className="chip-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" autoFocus />
          </div>
          <div className="account-edit-grid">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </div>
          <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
          <div className="chip-editor-actions">
            <button className="link" onClick={() => setEditing(false)}>Cancel</button>
            <button className="primary sm" onClick={() => void save()} disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="account-card" style={{ ['--acct-accent' as string]: meta.color }}>
      <div className="acct-top">
        <AccountBadge name={account.name} />
        <h3>{account.name}</h3>
        <button className="icon-btn card-edit" title="Rename or change emoji" onClick={openEdit}>✏️</button>
      </div>
      <strong className="acct-balance">{formatMoney(balance.balance, balance.currency)}</strong>
      <div className="acct-flows">
        <span className="income">+{formatMoney(balance.income, balance.currency)}</span>
        <span className="expense">-{formatMoney(balance.expense, balance.currency)}</span>
      </div>
      <span className="muted" style={{ fontSize: '0.74rem' }}>Opening {formatMoney(balance.openingBalance, balance.currency)}</span>
    </article>
  );
}

function AccountsView() {
  const { accounts, transactions, carryForward, selectedMonth } = useLedger();
  const [query, setQuery] = useState('');
  const month = monthKey(selectedMonth);
  const balances = computeAccountBalances(accounts, transactions, { carryForward, month });
  const total = balances.reduce((sum, a) => sum + a.balance, 0);

  const term = query.trim().toLowerCase();
  const filtered = term ? balances.filter((b) => b.name.toLowerCase().includes(term)) : balances;

  return (
    <div className="stack">
      <div className="hero-stat">
        <span>{carryForward ? 'Total balance (running)' : `Total balance · ${monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}`}</span>
        <strong className="balance">{formatMoney(total)}</strong>
      </div>
      {balances.length > 0 ? (
        <div className="search-field">
          <span className="search-ico" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            aria-label="Search accounts"
          />
          {query ? (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>
          ) : null}
        </div>
      ) : null}
      <div className="account-grid">
        {balances.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1 / -1' }}><span className="emoji">🏦</span><span className="muted">No accounts yet.</span></div>
        ) : null}
        {balances.length > 0 && filtered.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1 / -1' }}><span className="emoji">🔍</span><span className="muted">No accounts match “{query}”.</span></div>
        ) : null}
        {filtered.map((balance) => {
          const account = accounts.find((a) => a.name === balance.name) ?? {
            name: balance.name,
            currency: balance.currency,
            openingBalance: balance.openingBalance,
            active: true
          };
          return <AccountStatCard key={balance.name} account={account} balance={balance} />;
        })}
      </div>
    </div>
  );
}

function MoreView() {
  const { budgets, transactions, selectedMonth, saveBudget, categories, beginExport, resetAllData } = useLedger();
  const month = monthKey(selectedMonth);
  const progress = budgetProgressForMonth(budgets, transactions, month);
  const expenseCategories = categories.filter((c) => c.active && c.type === 'expense');

  return (
    <div className="stack">
      <StorageSettingsPanel />

      <SyncOtherDevicesPanel />

      <SettingsPanel />

      <ManagePanel />

      <BudgetForm categories={expenseCategories.map((c) => c.name)} onSave={saveBudget} month={month} />

      <div className="panel">
        <div className="panel-head"><h3>Budget progress — {monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}</h3></div>
        {progress.length === 0 ? <p className="muted">No budgets set for this month.</p> : null}
        {progress.map((row) => {
          const meta = getCategoryMeta(row.category);
          const pct = Math.min(row.percent, 100);
          return (
            <div className={`budget-row ${row.overBudget ? 'over' : ''}`} key={row.category}>
              <div className="b-head">
                <strong>{meta.emoji} {row.category}</strong>
                <span className={row.overBudget ? 'badge danger' : row.percent >= 80 ? 'badge' : 'badge good'}>
                  {row.overBudget ? 'Over budget' : `${row.percent.toFixed(0)}%`}
                </span>
              </div>
              <div className="bar-track budget">
                <div
                  className={`bar-fill ${row.overBudget ? 'over' : ''}`}
                  style={{ width: `${pct}%`, backgroundColor: row.overBudget ? 'var(--danger)' : meta.color }}
                />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                {formatMoney(row.spent)} of {formatMoney(row.budget)} · {formatMoney(Math.max(row.remaining, 0))} left
              </p>
            </div>
          );
        })}
      </div>

      {/* Web keeps Export / Import / Erase in the left sidebar, so this panel is
          only shown on mobile where the sidebar is replaced by the tab bar. */}
      <div className="panel mobile-only">
        <h3>Backup &amp; restore</h3>
        <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.86rem', lineHeight: 1.5 }}>
          Your data lives only on this device. Export an Excel workbook to back it up, or import a CSV or Excel
          file. Importing replaces everything after you confirm.
        </p>
        <div className="action-cards">
          <button className="action-card" onClick={() => beginExport()}>
            <span className="ac-ico">⬇️</span>
            <strong>Export Excel</strong>
            <span>Download all transactions as an .xlsx workbook.</span>
          </button>
          <ImportButton asCard />
          <button className="action-card danger" onClick={() => void resetAllData()}>
            <span className="ac-ico">🗑️</span>
            <strong>Erase all data</strong>
            <span>Reset this device to an empty ledger. Cannot be undone.</span>
          </button>
        </div>
      </div>

      <FeedbackPanel />
    </div>
  );
}

const DEV_EMAIL = 'dushyant.sharma1997@gmail.com';

function FeedbackPanel() {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${DEV_EMAIL}?subject=${encodeURIComponent('Money Sheets — Feedback')}&body=${encodeURIComponent(
    'Hi Dushyant,\n\nHere is my feedback about Money Sheets:\n\n'
  )}`;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(DEV_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel feedback-panel">
      <div className="panel-head"><h3>Feedback &amp; contact</h3></div>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.86rem', lineHeight: 1.5 }}>
        Found a bug or have an idea? I&rsquo;d love to hear it. Send me an email and I&rsquo;ll get back to you.
      </p>
      <div className="feedback-actions">
        <a className="primary feedback-btn" href={mailto}>✉️ Contact developer</a>
        <button type="button" className="ghost" onClick={() => void copyEmail()}>
          {copied ? '✓ Copied' : 'Copy email'}
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog() {
  const { confirmDialog, answerConfirm } = useLedger();
  if (!confirmDialog) return null;

  const tone = confirmDialog.tone ?? 'default';
  return (
    <div className="modal-backdrop" onClick={() => answerConfirm(false)}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon ${tone === 'danger' ? 'danger' : 'warn'}`}>{confirmDialog.icon ?? '⚠️'}</div>
        <h3 style={{ margin: 0 }}>{confirmDialog.title}</h3>
        <p className="muted confirm-text">{confirmDialog.message}</p>
        <div className="confirm-actions">
          <button className="ghost" onClick={() => answerConfirm(false)}>
            {confirmDialog.cancelLabel ?? 'Cancel'}
          </button>
          <button
            className={tone === 'danger' ? 'primary danger' : 'primary'}
            onClick={() => answerConfirm(true)}
            autoFocus
          >
            {confirmDialog.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function activeStorageDisplay(info: ReturnType<typeof useLedger>['effectiveStorage']) {
  if (info.isTursoFallback) {
    return {
      icon: '☁️',
      title: 'Turso unavailable',
      subtitle: 'Offline — using the local copy on this device',
      badge: 'OFFLINE FALLBACK',
      tone: 'warn' as const
    };
  }
  if (info.effectiveMode === 'turso') {
    return {
      icon: '☁️',
      title: 'Turso DB',
      subtitle: 'Synced across devices that use these credentials',
      badge: 'ACTIVE',
      tone: 'ok' as const
    };
  }
  return {
    icon: '💻',
    title: 'Local Storage',
    subtitle: 'Data stored on this device only',
    badge: 'ACTIVE',
    tone: 'ok' as const
  };
}

function StorageSettingsPanel() {
  const { storagePrefs, effectiveStorage, busy, applyStorageSettings, importExcelToTurso } = useLedger();
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [draftMode, setDraftMode] = useState<StorageMode>(storagePrefs.mode);
  const [replaceTarget, setReplaceTarget] = useState<StorageMode | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const active = activeStorageDisplay(effectiveStorage);
  const online = effectiveStorage.isOnline;
  // Credentials are now entered via Sync Other Devices (pairing or Advanced),
  // so this panel only switches the mode using whatever is already saved.
  const tursoComplete = isTursoConfigComplete(storagePrefs.turso);
  const needsCredentials = draftMode === 'turso' && !tursoComplete;

  const dirty = draftMode !== storagePrefs.mode;
  const canSave = dirty && (draftMode === 'local' || tursoComplete) && !busy;

  function resetDraft() {
    setDraftMode(storagePrefs.mode);
  }

  function confirmReplace(targetMode: StorageMode): Promise<boolean> {
    setReplaceTarget(targetMode);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }

  function resolveConfirm(value: boolean) {
    setReplaceTarget(null);
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
  }

  async function save() {
    const next: StoragePreferences = { mode: draftMode, turso: storagePrefs.turso };
    await applyStorageSettings(next, confirmReplace);
    // Success triggers a full reload; if it returns we either aborted or errored.
  }

  return (
    <div className="panel storage-panel">
      <div className="panel-head">
        <h3>Storage</h3>
      </div>

      <span className="storage-section-label">Active storage</span>
      <div className={`storage-active-card ${active.tone}`}>
        <span className="storage-active-ico">{active.icon}</span>
        <div className="storage-active-body">
          <strong>{active.title}</strong>
          <span className="muted">{active.subtitle}</span>
        </div>
        <span className={`storage-badge ${active.tone}`}>{active.badge}</span>
      </div>

      <span className="storage-section-label">Change storage mode</span>
      <div className="storage-mode-grid">
        <button
          type="button"
          className={`storage-mode-card ${draftMode === 'local' ? 'selected' : ''}`}
          onClick={() => setDraftMode('local')}
        >
          <span className="storage-mode-ico">💻</span>
          <strong>Local Storage</strong>
          <span className="muted">This device only</span>
        </button>
        <button
          type="button"
          className={`storage-mode-card ${draftMode === 'turso' ? 'selected' : ''} ${online ? '' : 'disabled'}`}
          onClick={() => online && setDraftMode('turso')}
          disabled={!online}
          title={online ? undefined : 'Requires an internet connection'}
        >
          <span className="storage-mode-ico">☁️</span>
          <strong>Turso DB</strong>
          <span className="muted">{online ? 'Synced across devices' : 'Requires internet'}</span>
        </button>
      </div>
      <p className="storage-hint muted">Changes apply after Save &amp; Reload.</p>

      {needsCredentials ? (
        <div className="storage-config">
          <p className="storage-hint muted">
            No cloud credentials on this device yet. Use <strong>Sync Other Devices</strong> below to scan
            a pairing QR from a connected device, or open its <strong>Advanced</strong> section to paste a
            database URL and token.
          </p>
        </div>
      ) : null}

      <div className="storage-actions">
        <button type="button" className="ghost" onClick={resetDraft} disabled={!dirty || busy}>Cancel</button>
        <button type="button" className="primary" onClick={() => void save()} disabled={!canSave}>
          Save &amp; Reload
        </button>
      </div>

      {storagePrefs.mode === 'turso' ? (
        <div className="storage-config" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-soft)' }}>
          <span className="storage-section-label">Import from Excel file</span>
          <p className="storage-hint muted">
            Read transactions from an Excel/CSV file and push them to your Turso database. This replaces
            the data in Turso and on this device.
          </p>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importExcelToTurso(file);
            }}
          />
          <div className="storage-test-row">
            <button
              type="button"
              className="ghost sm"
              onClick={() => excelInputRef.current?.click()}
              disabled={busy || !online}
              title={online ? undefined : 'Connect to Turso to import.'}
            >
              Import Excel → Turso
            </button>
            {!online ? <span className="storage-test-result error">Connect to Turso to import.</span> : null}
          </div>
        </div>
      ) : null}

      {replaceTarget ? (
        <StorageReplaceModal
          targetMode={replaceTarget}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      ) : null}
    </div>
  );
}

function SettingsPanel() {
  const { carryForward, setCarryForward, showcaseMode, enableShowcaseMode, exitShowcaseMode, busy } = useLedger();

  return (
    <div className="panel">
      <h3>Settings</h3>
      <div className="setting-row">
        <div className="setting-text">
          <strong>Monthly carry forward</strong>
          <span className="muted">
            When on, each month starts from the previous month's running balance. When off (default), every
            month is independent — income and expense do not carry into the next month.
          </span>
        </div>
        <button
          type="button"
          className={`switch ${carryForward ? 'on' : ''}`}
          role="switch"
          aria-checked={carryForward}
          disabled={busy}
          onClick={() => void setCarryForward(!carryForward)}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <div className="setting-row" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-soft)' }}>
        <div className="setting-text">
          <strong>Showcase mode</strong>
          <span className="muted">
            Load randomly generated demo data for the last 6 months — useful for demos and screenshots.
            {showcaseMode
              ? ' Currently active with sample records. Your real data is preserved.'
              : ' Runs in a sandbox — your real data stays safe and returns when you exit.'}
          </span>
        </div>
        {showcaseMode ? (
          <button type="button" className="primary sm" disabled={busy} onClick={() => void exitShowcaseMode()}>
            Exit showcase
          </button>
        ) : (
          <button type="button" className="primary sm" disabled={busy} onClick={() => void enableShowcaseMode()}>
            Enable showcase
          </button>
        )}
      </div>
    </div>
  );
}

function ManagePanel() {
  const [tab, setTab] = useState<'categories' | 'accounts'>('categories');

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Manage categories &amp; accounts</h3>
        <div className="pill-row">
          <button className={tab === 'categories' ? 'pill active' : 'pill'} onClick={() => setTab('categories')}>Categories</button>
          <button className={tab === 'accounts' ? 'pill active' : 'pill'} onClick={() => setTab('accounts')}>Accounts</button>
        </div>
      </div>
      {tab === 'categories' ? <CategoryManager /> : <AccountManager />}
    </div>
  );
}

function EmojiColorPicker({
  emoji,
  color,
  onEmoji,
  onColor
}: {
  emoji: string;
  color: string;
  onEmoji: (value: string) => void;
  onColor: (value: string) => void;
}) {
  return (
    <>
      <div className="swatch-row">
        {COLOR_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${color === c ? 'on' : ''}`}
            style={{ backgroundColor: c }}
            title={c}
            aria-label={`Use colour ${c}`}
            onClick={() => onColor(c)}
          />
        ))}
        <button
          type="button"
          className={`swatch clear ${!color ? 'on' : ''}`}
          title="Default colour"
          aria-label="Use default colour"
          onClick={() => onColor('')}
        >
          ∅
        </button>
      </div>
      <div className="emoji-palette">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            className={`emoji-pick ${emoji === e ? 'on' : ''}`}
            onClick={() => onEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}

function CategoryItem({ category }: { category: Category }) {
  const { updateCategory, deleteCategory } = useLedger();
  const meta = getCategoryMeta(category.name);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji ?? '');
  const [color, setColor] = useState(category.color ?? '');

  function open() {
    setName(category.name);
    setEmoji(category.emoji ?? '');
    setColor(category.color ?? '');
    setEditing(true);
  }

  async function save() {
    if (!name.trim()) return;
    await updateCategory(category.name, { name, emoji, color });
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="chip-item" style={{ ['--chip-accent' as string]: meta.color }}>
        <span className="chip-emoji">{meta.emoji}</span>
        <span className="chip-name">{category.name}</span>
        <button className="chip-btn" title="Edit" onClick={open}>✏️</button>
        <button className="chip-btn danger" title="Remove" onClick={() => void deleteCategory(category.name)}>×</button>
      </span>
    );
  }

  return (
    <div className="chip-editor">
      <div className="chip-editor-top">
        <span className="chip-emoji big">{emoji || meta.emoji}</span>
        <input
          className="chip-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          autoFocus
        />
      </div>
      <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <div className="chip-editor-actions">
        <button className="link" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary sm" onClick={() => void save()} disabled={!name.trim()}>Save</button>
      </div>
    </div>
  );
}

function CategoryManager() {
  const { categories, addCategory } = useLedger();
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');

  const expense = categories.filter((c) => c.type === 'expense');
  const income = categories.filter((c) => c.type === 'income');

  async function submit() {
    if (!name.trim()) return;
    await addCategory(name, type);
    setName('');
  }

  return (
    <div className="manage">
      <div className="manage-form">
        <input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <div className="type-toggle compact">
          <button className={type === 'expense' ? 'toggle active expense' : 'toggle'} onClick={() => setType('expense')}>Expense</button>
          <button className={type === 'income' ? 'toggle active income' : 'toggle'} onClick={() => setType('income')}>Income</button>
        </div>
        <button className="primary" onClick={() => void submit()} disabled={!name.trim()}>Add</button>
      </div>

      <div className="manage-group">
        <span className="manage-label expense">Expense · {expense.length}</span>
        <div className="chip-list">
          {expense.length === 0 ? <span className="muted">None yet.</span> : null}
          {expense.map((c) => <CategoryItem key={c.name} category={c} />)}
        </div>
      </div>

      <div className="manage-group">
        <span className="manage-label income">Income · {income.length}</span>
        <div className="chip-list">
          {income.length === 0 ? <span className="muted">None yet.</span> : null}
          {income.map((c) => <CategoryItem key={c.name} category={c} />)}
        </div>
      </div>
    </div>
  );
}

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR ₹' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'JPY', label: 'JPY ¥' }
];

function AccountBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const meta = getAccountMeta(name);
  return (
    <span
      className={`acct-badge ${size === 'sm' ? 'sm' : ''}`}
      style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
    >
      {meta.emoji || name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function AccountItem({ account, balance }: { account: Account; balance: number }) {
  const { updateAccount, deleteAccount } = useLedger();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [emoji, setEmoji] = useState(account.emoji ?? '');
  const [color, setColor] = useState(account.color ?? '');
  const [currency, setCurrency] = useState(account.currency);
  const [opening, setOpening] = useState(String(account.openingBalance));

  function open() {
    setName(account.name);
    setEmoji(account.emoji ?? '');
    setColor(account.color ?? '');
    setCurrency(account.currency);
    setOpening(String(account.openingBalance));
    setEditing(true);
  }

  async function save() {
    if (!name.trim()) return;
    await updateAccount(account.name, { name, emoji, color, currency, openingBalance: Number(opening) || 0 });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="account-row">
        <AccountBadge name={account.name} size="sm" />
        <div className="account-row-body">
          <strong>{account.name}</strong>
          <span className="muted">{account.currency} · opening {formatMoney(account.openingBalance, account.currency)}</span>
        </div>
        <strong className="balance">{formatMoney(balance, account.currency)}</strong>
        <button className="icon-btn" title="Edit account" onClick={open}>✏️</button>
        <button className="icon-btn danger" title="Remove account" onClick={() => void deleteAccount(account.name)}>🗑</button>
      </div>
    );
  }

  return (
    <div className="chip-editor account">
      <div className="chip-editor-top">
        <span className="chip-emoji big">{emoji || account.name.slice(0, 1).toUpperCase()}</span>
        <input
          className="chip-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          autoFocus
        />
      </div>
      <div className="account-edit-grid">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="number" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </div>
      <EmojiColorPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <div className="chip-editor-actions">
        <button className="link" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary sm" onClick={() => void save()} disabled={!name.trim()}>Save</button>
      </div>
    </div>
  );
}

function AccountManager() {
  const { accounts, transactions, addAccount } = useLedger();
  const balances = computeAccountBalances(accounts, transactions);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [opening, setOpening] = useState('');

  async function submit() {
    if (!name.trim()) return;
    await addAccount(name, currency, opening);
    setName('');
    setOpening('');
  }

  return (
    <div className="manage">
      <div className="manage-form accounts">
        <input
          placeholder="New account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="number" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
        <button className="primary" onClick={() => void submit()} disabled={!name.trim()}>Add</button>
      </div>

      <div className="account-rows">
        {accounts.length === 0 ? <span className="muted">No accounts yet.</span> : null}
        {accounts.map((account) => {
          const balance = balances.find((b) => b.name === account.name)?.balance ?? account.openingBalance;
          return <AccountItem key={account.name} account={account} balance={balance} />;
        })}
      </div>
    </div>
  );
}

function BudgetForm({
  categories,
  month,
  onSave
}: {
  categories: string[];
  month: string;
  onSave: (category: string, amount: string) => Promise<void>;
}) {
  const [category, setCategory] = useState(categories[0] ?? 'Food');
  const [amount, setAmount] = useState('');

  return (
    <div className="panel">
      <h3>Set a monthly budget</h3>
      <div className="filter-grid" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button
          className="primary"
          onClick={() => { void onSave(category, amount); setAmount(''); }}
          disabled={!amount.trim()}
        >
          Save
        </button>
      </div>
      <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>Applies to {month}</p>
    </div>
  );
}

function AddModal() {
  const {
    form,
    setForm,
    categories,
    accounts,
    editingId,
    busy,
    saveTransaction,
    cancelEdit
  } = useLedger();

  const [showCalc, setShowCalc] = useState(false);

  const expenseCategories = categories.filter((c) => c.active && c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.active && c.type === 'income');
  const activeCategories = form.type === 'income' ? incomeCategories : expenseCategories;

  const incomeDefault = incomeCategories[0]?.name ?? 'Salary';
  const expenseDefault = expenseCategories[0]?.name ?? 'Misc';

  useEffect(() => {
    if (!activeCategories.some((c) => c.name === form.category)) {
      setForm((current) => ({ ...current, category: activeCategories[0]?.name ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.category, categories]);

  return (
    <div className="modal-backdrop" onClick={cancelEdit}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <button className="link" onClick={cancelEdit}>Cancel</button>
          <strong>{editingId ? 'Edit record' : 'Add record'}</strong>
          <button className="link accent" onClick={() => void saveTransaction()} disabled={busy || !form.amount.trim()}>
            Save
          </button>
        </header>

        <div className="type-toggle">
          <button className={form.type === 'expense' ? 'toggle active expense' : 'toggle'} onClick={() => setForm({ ...form, type: 'expense', category: expenseDefault })}>Expense</button>
          <button className={form.type === 'income' ? 'toggle active income' : 'toggle'} onClick={() => setForm({ ...form, type: 'income', category: incomeDefault })}>Income</button>
        </div>

        <div className="amount-field">
          <span className="amount-label">Amount</span>
          <div className="amount-row">
            <span className="amount-currency">{form.currency === 'INR' ? '₹' : form.currency === 'USD' ? '$' : form.currency}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className={`amount-hero-input ${form.type}`}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              aria-label="Transaction amount"
            />
            <button type="button" className="calc-open-btn" onClick={() => setShowCalc(true)} title="Open calculator" aria-label="Open calculator">
              🧮
            </button>
          </div>
        </div>

        {showCalc ? (
          <Calculator
            initialValue={form.amount}
            currency={form.currency}
            onDone={(value) => {
              setForm((current) => ({ ...current, amount: value ? String(value) : '' }));
              setShowCalc(false);
            }}
            onCancel={() => setShowCalc(false)}
          />
        ) : null}

        <div className="field-group">
          <label>Category</label>
          <div className="chips">
            {activeCategories.map((c) => {
              const meta = getCategoryMeta(c.name);
              const on = form.category === c.name;
              return (
                <button
                  key={c.name}
                  className={on ? 'chip active' : 'chip'}
                  style={{ ['--chip-accent' as string]: meta.color }}
                  onClick={() => setForm({ ...form, category: c.name })}
                >
                  <span className="chip-ico">{meta.emoji}</span> {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field-group">
          <label>Account</label>
          <div className="chips">
            {accounts.filter((a) => a.active).map((a) => {
              const meta = getAccountMeta(a.name);
              const on = form.account === a.name;
              return (
                <button
                  key={a.name}
                  className={on ? 'chip active' : 'chip'}
                  style={{ ['--chip-accent' as string]: meta.color }}
                  onClick={() => setForm({ ...form, account: a.name, currency: a.currency })}
                >
                  <span className="chip-ico">{meta.emoji || a.name.slice(0, 1).toUpperCase()}</span> {a.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field-group">
          <label>Date</label>
          <DatePickerField value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </div>

        <div className="field-group">
          <label>Memo</label>
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note" />
        </div>

        <div className="field-group">
          <label>Receipt link</label>
          <input value={form.receiptUrl ?? ''} onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })} placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}
