import { useEffect, useMemo, useRef, useState } from 'react';
import { PwaShell } from './components/PwaShell';
import { AccountFilterSheet, ALL_ACCOUNTS } from './components/AccountFilterSheet';
import { CategoryFilterSheet } from './components/CategoryFilterSheet';
import { MobileTxnRow } from './components/MobileTxnRow';
import { ScrollTopButton } from './components/ScrollTopButton';
import { useEscToClose } from './hooks/useEscToClose';
import { useIsMobile } from './hooks/useMediaQuery';
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
  summarizeByCategory,
  buildCalendarMonth,
  buildCategoryTrends,
  computeAccountBalances,
  carryOverBalance,
  transactionsInMonth,
  dailySeries,
  averageDailyStats,
  budgetProgressForMonth,
  filterTransactions,
  type TrendGranularity
} from './ledger';
import { dateKey } from '../../shared/finance';
import type { Account, AccountBalance, Category, Transaction, TransactionType } from '../../shared/finance';
import { NAV as SHARED_NAV, MOBILE_TABBAR_NAV, TAB_TITLES } from '../../shared/nav';
import type { StorageMode, StoragePreferences } from '../../shared/storage/types';
import { isTursoConfigComplete } from '../../shared/storage/prefs';
import { Calculator } from './Calculator';
import { ProgressOverlay } from './components/ProgressOverlay';
import { ExportOptionsModal } from './components/ExportOptionsModal';
import { SyncStatusBar } from './components/SyncStatusBar';
import { StorageReplaceModal } from './components/StorageReplaceModal';
import { SyncOtherDevicesPanel } from './components/syncDevices/SyncOtherDevicesPanel';
import { useSyncTriggers } from './sync/useSyncTriggers';
import { useTheme } from './theme';
import './styles.css';

const NAV = SHARED_NAV;
const TITLES: Record<string, string> = TAB_TITLES;

const SIDEBAR_COLLAPSED_KEY = 'money-sheets-sidebar-collapsed';

const RECENT_LIMIT = 8;

const todayKey = () => dateKey();

const EMOJI_CHOICES = [
  '🛒', '🍜', '🍔', '☕', '⛽', '🚌', '🚗', '✈️', '🏠', '🛠️', '👕', '🎁',
  '🩺', '💊', '🏥', '💸', '📄', '📒', '🎓', '🎮', '🎵', '⚽', '🐾', '🌿',
  '💡', '📱', '💳', '🍷', '🏋️', '💰', '💵', '🏦', '📦', '🧾', '📌', '🎯'
];

const COLOR_CHOICES = [
  '#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff', '#ff7a45',
  '#22c3e6', '#f2495c', '#7ed957', '#c44dff', '#34d399', '#fbbf24'
];

/** Tiny inline-SVG sparkline (line or bar) for the summary cards. */
function Sparkline({
  values,
  color,
  variant = 'line',
  width = 120,
  height = 34
}: {
  values: number[];
  color: string;
  variant?: 'line' | 'bar';
  width?: number;
  height?: number;
}) {
  const data = values.length ? values : [0, 0];
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const y = (value: number) => height - ((value - min) / range) * (height - 4) - 2;

  if (variant === 'bar') {
    const slot = width / data.length;
    const barW = Math.max(1.5, slot * 0.6);
    const zeroY = y(0);
    return (
      <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
        {data.map((value, index) => {
          const cx = index * slot + slot / 2;
          const vy = y(value);
          const top = Math.min(vy, zeroY);
          const h = Math.max(1, Math.abs(zeroY - vy));
          return <rect key={index} x={cx - barW / 2} y={top} width={barW} height={h} rx={1} fill={color} opacity={0.85} />;
        })}
      </svg>
    );
  }

  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((value, index) => `${index * stepX},${y(value)}`).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

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

  // Throttled cloud checks on focus/visibility/pageshow + app start.
  useSyncTriggers();

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
          <span className="brand-mark large"><BrandGlyph /></span>
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
          <span className="brand-mark large"><BrandGlyph /></span>
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
      {MOBILE_TABBAR_NAV.map((item) => (
        <button
          key={item.id}
          className={ledger.mainTab === item.id ? 'tab active' : 'tab'}
          onClick={() => ledger.setMainTab(item.id)}
          aria-current={ledger.mainTab === item.id ? 'page' : undefined}
        >
          <span className="tab-ico"><NavIcon id={item.id} /></span>
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
      className={`theme-btn ${isDark ? 'dark' : 'light'}`}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      <span aria-hidden>{isDark ? '🌙' : '☀️'}</span>
    </button>
  );
}

/** Brand logo glyph (white bars on the accent tile) — crisp in light + dark. */
function BrandGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" aria-hidden>
      <rect x="4" y="12" width="4" height="7" rx="1.4" fill="#fff" />
      <rect x="10" y="7" width="4" height="12" rx="1.4" fill="#fff" />
      <rect x="16" y="10" width="4" height="9" rx="1.4" fill="#fff" />
    </svg>
  );
}

/** Clean line-style navigation icons (replaces the tinted emoji badges). */
function NavIcon({ id }: { id: string }) {
  const p = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };
  switch (id) {
    case 'trans':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="8" height="8" rx="1.6" />
          <rect x="13" y="3" width="8" height="5" rx="1.6" />
          <rect x="3" y="13" width="8" height="8" rx="1.6" />
          <rect x="13" y="10" width="8" height="11" rx="1.6" />
        </svg>
      );
    case 'stats':
      return (
        <svg {...p}>
          <path d="M4 20h16" />
          <path d="M6 20v-6" />
          <path d="M12 20V6" />
          <path d="M18 20v-9" />
        </svg>
      );
    case 'categories':
      return (
        <svg {...p}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h9" />
          <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'accounts':
      return (
        <svg {...p}>
          <path d="M3 10l9-6 9 6" />
          <path d="M5 10v9M9 10v9M15 10v9M19 10v9" />
          <path d="M3 21h18" />
        </svg>
      );
    case 'more':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
        </svg>
      );
    default:
      return null;
  }
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ledger = useLedger();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <span className="brand-mark"><BrandGlyph /></span>
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
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-ico"><NavIcon id={item.id} /></span>
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

/** `YYYY-MM-DD` -> `DD/MM/YYYY` for display in the typed date field. */
function toDisplayDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

/** Format raw typing into `DD/MM/YYYY`, auto-inserting the `/` delimiters. */
function formatTypedDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
}

/** Parse a `DD/MM/YYYY` string to a stored `YYYY-MM-DD` key, or null when invalid. */
function parseTypedDate(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (year < 1 || month < 1 || month > 12) return null;
  const daysInThatMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInThatMonth) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function DatePickerField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => toDisplayDate(value));
  const ref = useRef<HTMLDivElement>(null);
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // Keep the text field in sync when the value changes externally (calendar pick, edit).
  useEffect(() => {
    setText(toDisplayDate(value));
  }, [value]);

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

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleType(raw: string) {
    const formatted = formatTypedDate(raw);
    setText(formatted);
    const iso = parseTypedDate(formatted);
    if (iso) onChange(iso);
  }

  function handleBlur() {
    // Revert incomplete/invalid text back to the last valid value.
    if (parseTypedDate(text) === null) setText(toDisplayDate(value));
  }

  return (
    <div className={`date-field ${open ? 'open' : ''}`} ref={ref}>
      <div className="date-field-row">
        <span className="date-field-icon" aria-hidden>📅</span>
        <input
          className="date-field-input"
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={(e) => handleType(e.target.value)}
          onBlur={handleBlur}
          aria-label="Date (day / month / year)"
        />
        <button
          type="button"
          className="date-field-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Open calendar"
        >
          <span className="date-field-caret">▾</span>
        </button>
      </div>
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
  useEscToClose(onClose);
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

function DashboardCards({
  income,
  expense,
  balance,
  count,
  incomeSeries,
  expenseSeries,
  netSeries,
  averageDaily,
  avgPctChange
}: {
  income: number;
  expense: number;
  balance: number;
  count: number;
  incomeSeries: number[];
  expenseSeries: number[];
  netSeries: number[];
  averageDaily: number;
  avgPctChange: number;
}) {
  const up = avgPctChange >= 0;
  return (
    <div className="summary-cards">
      <div className="summary-card income">
        <div className="sc-head"><span>Income</span><span className="sc-ico">↗</span></div>
        <strong>{formatMoney(income)}</strong>
        <small>This month</small>
        <div className="sc-chart"><Sparkline values={incomeSeries} color="var(--income)" /></div>
      </div>
      <div className="summary-card expense">
        <div className="sc-head"><span>Expense</span><span className="sc-ico">↘</span></div>
        <strong>{formatMoney(expense)}</strong>
        <small>This month</small>
        <div className="sc-chart"><Sparkline values={expenseSeries} color="var(--expense)" /></div>
      </div>
      <div className="summary-card balance">
        <div className="sc-head"><span>Balance</span><span className="sc-ico">👛</span></div>
        <strong>{formatMoney(balance)}</strong>
        <small>This month</small>
        <small className="sc-sub">{count} transaction{count === 1 ? '' : 's'}</small>
      </div>
      <div className="summary-card average">
        <div className="sc-head"><span>Average Daily</span><span className="sc-ico">📊</span></div>
        <strong>{formatMoney(averageDaily)}</strong>
        <small>
          vs last month <span className={up ? 'sc-delta up' : 'sc-delta down'}>{up ? '▲' : '▼'} {Math.abs(avgPctChange).toFixed(1)}%</span>
        </small>
        <div className="sc-chart"><Sparkline values={netSeries} color="var(--accent)" variant="bar" /></div>
      </div>
    </div>
  );
}

/** Keep only the first `limit` transactions across date groups (for the recent list). */
function limitGroups(
  groups: ReturnType<typeof groupTransactionsByDate>,
  limit: number
): ReturnType<typeof groupTransactionsByDate> {
  const result: ReturnType<typeof groupTransactionsByDate> = [];
  let remaining = limit;
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    result.push({ ...group, items });
  }
  return result;
}

function TransView() {
  const {
    transactions,
    accounts,
    carryForward,
    filters,
    selectedMonth,
    setSelectedMonth,
    setFilters,
    startEdit,
    deleteTransaction
  } = useLedger();

  const [dayPopup, setDayPopup] = useState<string | null>(null);
  const [duration, setDuration] = useState<'all' | 'currentMonth'>('currentMonth');
  const [showFilters, setShowFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Keep the Recent transactions column no taller than the left column
  // (Calendar + Top categories), so both columns finish at the same height.
  const leftColRef = useRef<HTMLDivElement>(null);
  const [leftColHeight, setLeftColHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = leftColRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLeftColHeight(el.offsetHeight));
    ro.observe(el);
    setLeftColHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const month = monthKey(selectedMonth);
  const monthSummary = summarizeMonth(transactions, month);
  const series = dailySeries(transactions, month);
  const avgStats = averageDailyStats(transactions, month);

  const scoped = duration === 'currentMonth' ? transactionsInMonth(transactions, month) : transactions;
  const filtered = filterTransactions(scoped, filters);
  const allGroups = groupTransactionsByDate(filtered);
  const totalCount = filtered.length;
  const groups = showAll ? allGroups : limitGroups(allGroups, RECENT_LIMIT);

  const calendarDays = buildCalendarMonth(transactions, selectedMonth.getFullYear(), selectedMonth.getMonth());
  const expenseBreakdown = summarizeByCategory(transactions, month, 'expense');

  const broughtForward = carryForward ? carryOverBalance(accounts, transactions, month, true) : 0;
  const monthBalance = monthSummary.balance + broughtForward;
  const today = todayKey();

  const filtersActive =
    (filters.type && filters.type !== 'all') || duration !== 'currentMonth' || Boolean(filters.search?.trim());

  return (
    <div className="stack">
      <DashboardCards
        income={monthSummary.income}
        expense={monthSummary.expense}
        balance={monthBalance}
        count={monthSummary.count}
        incomeSeries={series.income}
        expenseSeries={series.expense}
        netSeries={series.net}
        averageDaily={avgStats.averageDaily}
        avgPctChange={avgStats.pctChange}
      />

      <div className="dashboard-grid">
        <div className="dashboard-left" ref={leftColRef}>
          <div className="panel">
            <div className="panel-head cal-head">
              <h3>Calendar</h3>
              <div className="cal-nav">
                <button
                  className="nav-btn sm"
                  aria-label="Previous month"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                >
                  ‹
                </button>
                <strong>{monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}</strong>
                <button
                  className="nav-btn sm"
                  aria-label="Next month"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                >
                  ›
                </button>
              </div>
            </div>
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
          </div>

          <div className="panel">
            <h3>Top categories this month</h3>
            {expenseBreakdown.length === 0 ? (
              <p className="muted">No expenses yet.</p>
            ) : (
              <div className="top-cats">
                {expenseBreakdown.slice(0, 6).map((row) => {
                  const meta = getCategoryMeta(row.category);
                  return (
                    <div className="top-cat" key={row.category}>
                      <span className="tc-ico" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>{meta.emoji}</span>
                      <span className="tc-name">{row.category}</span>
                      <div className="tc-bar">
                        <div className="tc-fill" style={{ width: `${Math.max(row.percent, 2)}%`, backgroundColor: meta.color }} />
                      </div>
                      <span className="tc-pct">{row.percent.toFixed(0)}%</span>
                      <strong className="tc-amt">{formatMoney(row.amount)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className="dashboard-right"
          style={leftColHeight ? ({ ['--left-col-h' as string]: `${leftColHeight}px` }) : undefined}
        >
          <div className="filter-bar">
            <select
              className="filter-type"
              value={filters.type ?? 'all'}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as typeof filters.type })}
            >
              <option value="all">All categories</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <div className="filter-search">
              <span className="fs-ico" aria-hidden>🔍</span>
              <input placeholder="Search transactions…" value={filters.search ?? ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <button
              type="button"
              className={`filter-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 5h18l-7 8v5l-4 2v-7z" />
              </svg>
              Filters
              {filtersActive ? <span className="filter-dot" aria-hidden /> : null}
            </button>
          </div>

          {showFilters ? (
            <div className="panel filter-extra">
              <span className="fe-label">Duration</span>
              <div className="radio-row">
                {(['all', 'currentMonth'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`radio-pill ${duration === d ? 'active' : ''}`}
                    onClick={() => setDuration(d)}
                  >
                    <span className="radio-dot" aria-hidden />
                    {d === 'all' ? 'All' : 'Current month'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="panel recent-panel">
            <div className="panel-head">
              <h3>Recent transactions</h3>
              {totalCount > RECENT_LIMIT ? (
                <button type="button" className="link accent" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? 'Show less' : 'View all'}
                </button>
              ) : null}
            </div>
            <div className="recent-scroll">
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
            {totalCount > RECENT_LIMIT && !showAll ? (
              <button type="button" className="view-all-btn" onClick={() => setShowAll(true)}>
                View all transactions ⌄
              </button>
            ) : null}
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
  const { transactions, selectedMonth, categories } = useLedger();
  const [granularity, setGranularity] = useState<TrendGranularity>('month');
  // Empty selection = show every category. Selecting categories isolates them.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const categoryNames = useMemo(
    () => categories.filter((cat) => cat.type === type).map((cat) => cat.name),
    [categories, type]
  );
  const trends = buildCategoryTrends(transactions, {
    granularity,
    type,
    topN: 6,
    endDate: selectedMonth,
    categoryNames
  });

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

function AccountPicker({
  accounts,
  value,
  amounts,
  allTotal,
  onChange
}: {
  accounts: Account[];
  value: string;
  amounts: Map<string, number>;
  allTotal: number;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAll = value === ALL_ACCOUNTS;
  const meta = getAccountMeta(isAll ? '' : value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={`cat-dd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="cat-dd-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="dd-emoji" style={isAll ? { background: 'var(--accent-soft)' } : { backgroundColor: `${meta.color}22`, color: meta.color }}>
          {isAll ? '🏦' : meta.emoji}
        </span>
        <span className="dd-current">{isAll ? 'All accounts' : value || 'Select account'}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open ? (
        <div className="cat-dd-pop" role="listbox">
          <div className="dd-group">
            <button
              type="button"
              className={`dd-item ${isAll ? 'on' : ''}`}
              onClick={() => { onChange(ALL_ACCOUNTS); setOpen(false); }}
            >
              <span className="dd-emoji" style={{ background: 'var(--accent-soft)' }}>🏦</span>
              <span className="dd-name">All accounts</span>
              {allTotal > 0 ? <span className="dd-amt">{formatMoney(allTotal)}</span> : null}
            </button>
          </div>
          <div className="dd-group">
            <span className="dd-group-label">Accounts</span>
            {accounts.map((account) => {
              const m = getAccountMeta(account.name);
              const amt = amounts.get(account.name) ?? 0;
              return (
                <button
                  key={account.name}
                  type="button"
                  className={`dd-item ${account.name === value ? 'on' : ''}`}
                  onClick={() => { onChange(account.name); setOpen(false); }}
                >
                  <span className="dd-emoji" style={{ backgroundColor: `${m.color}22`, color: m.color }}>{m.emoji}</span>
                  <span className="dd-name">{account.name}</span>
                  {amt > 0 ? <span className="dd-amt">{formatMoney(amt)}</span> : null}
                </button>
              );
            })}
          </div>
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
  const { transactions, categories, accounts, selectedMonth, startEdit, deleteTransaction, categoryFocus, clearCategoryFocus } =
    useLedger();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);
  const [selectedAccount, setSelectedAccount] = useState<string>(ALL_ACCOUNTS);
  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const activeAccounts = accounts.filter((a) => a.active);
  const accountNames = activeAccounts.map((a) => a.name);
  const isAllAccounts = selectedAccount === ALL_ACCOUNTS;
  const currentAccount = isAllAccounts
    ? ALL_ACCOUNTS
    : selectedAccount && accountNames.includes(selectedAccount)
      ? selectedAccount
      : accountNames[0] ?? '';
  const accountMeta = getAccountMeta(isAllAccounts ? '' : currentAccount);

  const monthAll = transactionsInMonth(transactions, month).filter((t) => !t.deleted);
  const amounts = new Map<string, number>();
  for (const t of monthAll) amounts.set(t.category, (amounts.get(t.category) ?? 0) + t.amount);
  const accountAmounts = new Map<string, number>();
  for (const t of monthAll) accountAmounts.set(t.account, (accountAmounts.get(t.account) ?? 0) + t.amount);
  const allTotal = monthAll.reduce((sum, t) => sum + t.amount, 0);

  const monthRows = filterTransactions(monthAll, {
    category: isAll ? undefined : current,
    account: isAllAccounts ? undefined : currentAccount
  });
  const groups = groupTransactionsByDate(monthRows);
  const visible = groups.flatMap((g) => g.items);
  const total = visible.reduce((sum, t) => sum + t.amount, 0);
  const isExpense = currentCat?.type !== 'income';
  const heroEmoji = isAll ? '🗂️' : meta.emoji;
  const heroColor = isAll ? 'var(--accent)' : meta.color;
  const heroName = isAll ? 'All categories' : current || 'No categories';

  if (isMobile) {
    const q = search.trim().toLowerCase();
    const searchRows = q
      ? monthRows.filter((t) =>
          [t.category, t.account, t.note, String(t.amount), t.currency].join(' ').toLowerCase().includes(q)
        )
      : monthRows;
    const mGroups = groupTransactionsByDate(searchRows);
    const income = searchRows.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = searchRows.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const net = income - expense;
    const counts = new Map<string, number>();
    for (const t of monthAll) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    const sheetCategories = [...expenseCats, ...incomeCats].map((cat) => ({
      name: cat.name,
      count: counts.get(cat.name) ?? 0
    }));
    const accountCounts = new Map<string, number>();
    for (const t of monthAll) accountCounts.set(t.account, (accountCounts.get(t.account) ?? 0) + 1);
    const sheetAccounts = activeAccounts.map((account) => ({
      name: account.name,
      count: accountCounts.get(account.name) ?? 0
    }));

    return (
      <div className="stack mcat">
        <div className="msum">
          <div className="msum-col">
            <span>Income</span>
            <strong className="income">{formatMoney(income)}</strong>
          </div>
          <i className="msum-div" />
          <div className="msum-col">
            <span>Expenses</span>
            <strong className="expense">{formatMoney(expense)}</strong>
          </div>
          <i className="msum-div" />
          <div className="msum-col">
            <span>Net</span>
            <strong className={net >= 0 ? 'income' : 'expense'}>
              {net < 0 ? '-' : ''}{formatMoney(Math.abs(net))}
            </strong>
          </div>
        </div>

        <div className="mcat-filter">
          <button type="button" className="mcat-dd" onClick={() => setSheetOpen(true)}>
            <span className="mcat-dd-ico" style={isAll ? undefined : { backgroundColor: `${meta.color}22`, color: meta.color }}>
              {isAll ? '📁' : meta.emoji}
            </span>
            <span className="mcat-dd-text">{isAll ? 'All Categories' : current || 'Select category'}</span>
            <span className="mcat-dd-caret">▾</span>
          </button>
          <button type="button" className="mcat-dd" onClick={() => setAccountSheetOpen(true)}>
            <span
              className="mcat-dd-ico"
              style={isAllAccounts ? undefined : { backgroundColor: `${accountMeta.color}22`, color: accountMeta.color }}
            >
              {isAllAccounts ? '🏦' : accountMeta.emoji}
            </span>
            <span className="mcat-dd-text">{isAllAccounts ? 'All Accounts' : currentAccount || 'Select account'}</span>
            <span className="mcat-dd-caret">▾</span>
          </button>
          <button
            type="button"
            className={`mcat-search-btn ${searchOpen ? 'on' : ''}`}
            aria-label="Search transactions"
            onClick={() => setSearchOpen((v) => { if (v) setSearch(''); return !v; })}
          >
            🔍
          </button>
        </div>

        {searchOpen ? (
          <div className="mcat-search">
            <span aria-hidden>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, account, amount…"
              autoFocus
            />
            {search ? (
              <button type="button" className="mcat-search-clear" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>
            ) : null}
          </div>
        ) : null}

        {currentCat ? (
          <div className="mcat-selhead">
            <span className="muted">{searchRows.length} transaction{searchRows.length === 1 ? '' : 's'} · {current}</span>
            <button type="button" className="link accent" onClick={() => setEditing((v) => !v)}>Edit category</button>
          </div>
        ) : null}

        {editing && currentCat ? (
          <CategoryEditPanel key={currentCat.name} category={currentCat} onClose={() => setEditing(false)} />
        ) : null}

        <div className="mcat-groups">
          {mGroups.length === 0 ? (
            <div className="empty">
              <span className="emoji">🗂️</span>
              <strong>Nothing to show this month</strong>
              <span className="muted">Switch months with ‹ › or pick another category.</span>
            </div>
          ) : null}
          {mGroups.map((group) => {
            const dayNet = group.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
            const isCollapsed = collapsed[group.date];
            return (
              <section key={group.date} className="mcard">
                <button
                  type="button"
                  className="mcard-head"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.date]: !prev[group.date] }))}
                >
                  <span className="mcard-day">{group.parts.day}</span>
                  <div className="mcard-meta">
                    <span className="mcard-week">{group.parts.relative ?? group.parts.weekdayShort}</span>
                    <span className="mcard-date">{group.parts.dateText}</span>
                  </div>
                  <span className="mcard-total">
                    <small>Daily total</small>
                    <em className={dayNet >= 0 ? 'income' : 'expense'}>
                      {dayNet >= 0 ? '+' : '-'}{formatMoney(Math.abs(dayNet))}
                    </em>
                  </span>
                  <span className="mcard-caret">{isCollapsed ? '⌄' : '⌃'}</span>
                </button>
                {isCollapsed
                  ? null
                  : group.items.map((txn) => {
                      const rowMeta = getCategoryMeta(txn.category);
                      const note = txn.note?.trim();
                      const primary = note || txn.category;
                      const secondary = note ? `${txn.account} • ${txn.category}` : txn.account;
                      return (
                        <MobileTxnRow
                          key={txn.id}
                          txn={txn}
                          primary={primary}
                          secondary={secondary}
                          emoji={rowMeta.emoji}
                          color={rowMeta.color}
                          onEdit={startEdit}
                          onDelete={(t) => void deleteTransaction(t)}
                        />
                      );
                    })}
              </section>
            );
          })}
        </div>

        <ScrollTopButton />
        <CategoryFilterSheet
          open={sheetOpen}
          categories={sheetCategories}
          selected={selected}
          onSelect={(name) => { setSelected(name); setEditing(false); }}
          onClose={() => setSheetOpen(false)}
        />
        <AccountFilterSheet
          open={accountSheetOpen}
          accounts={sheetAccounts}
          selected={selectedAccount}
          onSelect={setSelectedAccount}
          onClose={() => setAccountSheetOpen(false)}
        />
      </div>
    );
  }

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
          <AccountPicker
            accounts={activeAccounts}
            value={currentAccount}
            amounts={accountAmounts}
            allTotal={allTotal}
            onChange={setSelectedAccount}
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
    <div className="more-grid">
      <div className="more-col">
        <StorageSettingsPanel />

        <SyncOtherDevicesPanel />

        <SettingsPanel />
      </div>

      <div className="more-col">
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
  useEscToClose(() => answerConfirm(false), Boolean(confirmDialog));
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

/** Description input with auto-suggestions sourced from prior notes across all months. */
function DescriptionField({
  value,
  onChange,
  transactions
}: {
  value: string;
  onChange: (value: string) => void;
  transactions: Transaction[];
}) {
  const [focused, setFocused] = useState(false);
  const query = value.trim().toLowerCase();
  const suggestions = query
    ? Array.from(
        new Set(
          transactions
            .filter((t) => !t.deleted && t.note && t.note.toLowerCase().includes(query) && t.note.trim().toLowerCase() !== query)
            .map((t) => t.note.trim())
        )
      ).slice(0, 6)
    : [];

  return (
    <div className="desc-field">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="Add a note about this transaction…"
      />
      {focused && suggestions.length > 0 ? (
        <div className="desc-suggest">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s}
              className="desc-suggest-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Rank a set of names by how often (and how recently) they appear in history. */
function useUsageRank(transactions: Transaction[], key: 'category' | 'account') {
  return useMemo(() => {
    const rank = new Map<string, number>();
    for (const t of transactions) {
      if (t.deleted) continue;
      const name = t[key];
      if (!name) continue;
      // Recency-weighted: each use counts, most recent date breaks ties.
      const prev = rank.get(name) ?? 0;
      const recency = t.date ? Number(t.date.replace(/-/g, '')) / 1e8 : 0;
      rank.set(name, prev + 1 + recency * 0.001);
    }
    return rank;
  }, [transactions, key]);
}

const PICKER_INITIAL = 8;

/** True on the mobile bottom-sheet breakpoint, where lists scroll horizontally. */
function useIsNarrow(max = 760) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width:${max}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${max}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [max]);
  return narrow;
}

function AddCategoryPicker({
  items,
  value,
  onChange,
  transactions,
  onManage
}: {
  items: Category[];
  value: string;
  onChange: (name: string) => void;
  transactions: Transaction[];
  onManage: () => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const narrow = useIsNarrow();
  const rank = useUsageRank(transactions, 'category');
  const q = query.trim().toLowerCase();

  const sorted = useMemo(
    () => [...items].sort((a, b) => (rank.get(b.name) ?? 0) - (rank.get(a.name) ?? 0)),
    [items, rank]
  );

  // On mobile the row scrolls horizontally, so show every category up front.
  let visible = sorted;
  if (q) {
    visible = items.filter((c) => c.name.toLowerCase().includes(q));
  } else if (!expanded && !narrow) {
    visible = sorted.slice(0, PICKER_INITIAL);
    if (value && !visible.some((c) => c.name === value)) {
      const sel = items.find((c) => c.name === value);
      if (sel) visible = [sel, ...visible.slice(0, PICKER_INITIAL - 1)];
    }
  }
  const canExpand = !q && !narrow && items.length > PICKER_INITIAL;

  return (
    <section className="picker">
      <div className="section-head">
        <label>Category</label>
        <button type="button" className="manage-link" onClick={onManage}>
          Manage categories <span aria-hidden>⚙</span>
        </button>
      </div>
      <div className="picker-search">
        <span className="ps-ico" aria-hidden>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search category…"
          aria-label="Search category"
        />
      </div>
      <div className="chips">
        {visible.map((c) => {
          const meta = getCategoryMeta(c.name);
          const on = value === c.name;
          return (
            <button
              key={c.name}
              type="button"
              className={on ? 'chip active' : 'chip'}
              style={{ ['--chip-accent' as string]: meta.color }}
              onClick={() => onChange(c.name)}
            >
              <span className="chip-ico">{meta.emoji}</span> {c.name}
            </button>
          );
        })}
        {visible.length === 0 ? <span className="picker-empty">No matches</span> : null}
      </div>
      {canExpand ? (
        <button type="button" className="show-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'} <span aria-hidden>{expanded ? '⌃' : '⌄'}</span>
        </button>
      ) : null}
    </section>
  );
}

function AddAccountPicker({
  items,
  value,
  onChange,
  transactions,
  onManage
}: {
  items: Account[];
  value: string;
  onChange: (account: Account) => void;
  transactions: Transaction[];
  onManage: () => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const narrow = useIsNarrow();
  const rank = useUsageRank(transactions, 'account');
  const q = query.trim().toLowerCase();

  const balances = useMemo(() => computeAccountBalances(items, transactions), [items, transactions]);
  const balanceOf = useMemo(() => new Map(balances.map((b) => [b.name, b.balance])), [balances]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (rank.get(b.name) ?? 0) - (rank.get(a.name) ?? 0)),
    [items, rank]
  );

  // On mobile the row scrolls horizontally, so show every account up front.
  let visible = sorted;
  if (q) {
    visible = items.filter((a) => a.name.toLowerCase().includes(q));
  } else if (!expanded && !narrow) {
    visible = sorted.slice(0, PICKER_INITIAL);
    if (value && !visible.some((a) => a.name === value)) {
      const sel = items.find((a) => a.name === value);
      if (sel) visible = [sel, ...visible.slice(0, PICKER_INITIAL - 1)];
    }
  }
  const canExpand = !q && !narrow && items.length > PICKER_INITIAL;

  return (
    <section className="picker">
      <div className="section-head">
        <label>Account</label>
        <button type="button" className="manage-link" onClick={onManage}>
          Manage accounts <span aria-hidden>⚙</span>
        </button>
      </div>
      <div className="picker-search">
        <span className="ps-ico" aria-hidden>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search account…"
          aria-label="Search account"
        />
      </div>
      <div className="acct-grid">
        {visible.map((a) => {
          const meta = getAccountMeta(a.name);
          const on = value === a.name;
          const bal = balanceOf.get(a.name);
          return (
            <button
              key={a.name}
              type="button"
              className={on ? 'acct-card active' : 'acct-card'}
              style={{ ['--chip-accent' as string]: meta.color }}
              onClick={() => onChange(a)}
            >
              <span className="acct-avatar">{meta.emoji || a.name.slice(0, 1).toUpperCase()}</span>
              <span className="acct-info">
                <strong>{a.name}</strong>
                {bal !== undefined ? <span className="acct-bal">{formatMoney(bal, a.currency)}</span> : null}
              </span>
              {on ? <span className="acct-check" aria-hidden>✓</span> : null}
            </button>
          );
        })}
        {visible.length === 0 ? <span className="picker-empty">No matches</span> : null}
      </div>
      {canExpand ? (
        <button type="button" className="show-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'} <span aria-hidden>{expanded ? '⌃' : '⌄'}</span>
        </button>
      ) : null}
    </section>
  );
}

function AddModal() {
  const {
    form,
    setForm,
    categories,
    accounts,
    transactions,
    editingId,
    busy,
    saveTransaction,
    cancelEdit,
    setMainTab
  } = useLedger();

  const [showCalc, setShowCalc] = useState(false);
  useEscToClose(cancelEdit);

  // Lock the page behind the sheet so there's a single (inner) scrollbar.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const expenseCategories = categories.filter((c) => c.active && c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.active && c.type === 'income');
  const activeCategories = form.type === 'income' ? incomeCategories : expenseCategories;
  const activeAccounts = accounts.filter((a) => a.active);

  const incomeDefault = incomeCategories[0]?.name ?? 'Salary';
  const expenseDefault = expenseCategories[0]?.name ?? 'Misc';

  useEffect(() => {
    if (!activeCategories.some((c) => c.name === form.category)) {
      setForm((current) => ({ ...current, category: activeCategories[0]?.name ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.category, categories]);

  const goManage = () => {
    cancelEdit();
    setMainTab('more');
  };

  const noteLen = (form.note ?? '').length;

  const handleReceiptFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setForm((cur) => ({ ...cur, receiptUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    input.value = '';
  };
  const receiptAttached = Boolean(form.receiptUrl && form.receiptUrl.startsWith('data:'));

  return (
    <div className="modal-backdrop" onClick={cancelEdit}>
      <div className="modal add-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head add-head">
          <button className="modal-x" onClick={cancelEdit} aria-label="Close">✕</button>
          <strong>{editingId ? 'Edit record' : 'Add record'}</strong>
          <ThemeToggle />
        </header>

        <div className="modal-body">
        <div className="seg-toggle">
          <button
            type="button"
            className={form.type === 'expense' ? 'seg active expense' : 'seg'}
            onClick={() => setForm({ ...form, type: 'expense', category: expenseDefault })}
          >
            <span className="seg-ico" aria-hidden>↓</span> Expense
          </button>
          <button
            type="button"
            className={form.type === 'income' ? 'seg active income' : 'seg'}
            onClick={() => setForm({ ...form, type: 'income', category: incomeDefault })}
          >
            <span className="seg-ico" aria-hidden>↗</span> Income
          </button>
        </div>

        <div className="field-group">
          <label>Date</label>
          <DatePickerField value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </div>

        <div className="field-group">
          <div className="section-head">
            <label>Description <span className="opt">(optional)</span></label>
            <span className="char-count">{noteLen}/200</span>
          </div>
          <DescriptionField
            value={form.note}
            onChange={(note) => setForm({ ...form, note: note.slice(0, 200) })}
            transactions={transactions}
          />
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
              placeholder="0.00"
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

        <AddCategoryPicker
          items={activeCategories}
          value={form.category}
          onChange={(category) => setForm({ ...form, category })}
          transactions={transactions}
          onManage={goManage}
        />

        <AddAccountPicker
          items={activeAccounts}
          value={form.account}
          onChange={(a) => setForm({ ...form, account: a.name, currency: a.currency })}
          transactions={transactions}
          onManage={goManage}
        />

        <div className="field-group">
          <label>Receipt <span className="opt">(optional)</span></label>
          <div className="receipt-input add-web-only">
            <span className="ri-ico" aria-hidden>🔗</span>
            <input
              value={form.receiptUrl && !form.receiptUrl.startsWith('data:') ? form.receiptUrl : ''}
              onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
              placeholder="Paste link or attach receipt"
            />
          </div>
          <div className="receipt-cards add-mobile-only">
            <label className="receipt-card">
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleReceiptFile(e.currentTarget)} />
              <span className="rc-ico" aria-hidden>📷</span>
              <span className="rc-text"><strong>Take Photo</strong><span>Capture receipt</span></span>
            </label>
            <label className="receipt-card">
              <input type="file" accept="image/*" hidden onChange={(e) => handleReceiptFile(e.currentTarget)} />
              <span className="rc-ico" aria-hidden>📎</span>
              <span className="rc-text"><strong>Upload</strong><span>Choose from gallery</span></span>
            </label>
          </div>
          {receiptAttached ? (
            <div className="receipt-attached">
              <span>📎 Receipt attached</span>
              <button type="button" className="link" onClick={() => setForm({ ...form, receiptUrl: '' })}>Remove</button>
            </div>
          ) : null}
        </div>
        </div>

        <footer className="modal-foot">
          <button className="ghost" onClick={cancelEdit}>Cancel</button>
          <button
            className="primary modal-save"
            onClick={() => void saveTransaction()}
            disabled={busy || !form.amount.trim()}
          >
            {editingId ? 'Save changes' : 'Save record'}
          </button>
        </footer>
      </div>
    </div>
  );
}
