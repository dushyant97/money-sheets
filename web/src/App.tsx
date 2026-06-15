import { useEffect, useRef, useState } from 'react';
import {
  LedgerProvider,
  useLedger,
  formatMoney,
  formatSignedMoney,
  getCategoryMeta,
  groupTransactionsByDate,
  categoryPieSlices,
  monthTitle,
  monthKey,
  summarizeMonth,
  summarizeWeek,
  summarizeByCategory,
  buildCalendarMonth,
  computeAccountBalances,
  carryOverBalance,
  transactionsInMonth,
  budgetProgressForMonth,
  filterTransactions,
  type HomeView
} from './ledger';
import type { TransactionType } from '../../shared/finance';
import { Calculator } from './Calculator';
import './styles.css';

const NAV = [
  { id: 'trans' as const, label: 'Transactions', icon: '📒' },
  { id: 'stats' as const, label: 'Statistics', icon: '📊' },
  { id: 'accounts' as const, label: 'Accounts', icon: '🏦' },
  { id: 'more' as const, label: 'Budgets & Data', icon: '⚙️' }
];

const TITLES: Record<string, string> = {
  trans: 'Transactions',
  stats: 'Statistics',
  accounts: 'Accounts',
  more: 'Budgets & Data'
};

const HOME_VIEWS: Array<{ id: HomeView; label: string }> = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'summary', label: 'Summary' }
];

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function App() {
  return (
    <LedgerProvider>
      <AppShell />
    </LedgerProvider>
  );
}

function AppShell() {
  const ledger = useLedger();

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
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{TITLES[ledger.mainTab] ?? 'Transactions'}</h1>
            {ledger.message ? (
              <p className="status">
                {ledger.busy ? <span className="auth-spinner" style={{ width: 12, height: 12, margin: 0, borderWidth: 2 }} /> : null}
                {ledger.message}
              </p>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button className="fab" onClick={() => { ledger.cancelEdit(); ledger.setShowAdd(true); }}>
              <span className="plus">+</span> Add record
            </button>
          </div>
        </header>

        <div className="content">
          {ledger.mainTab === 'trans' ? <TransView /> : null}
          {ledger.mainTab === 'stats' ? <StatsView /> : null}
          {ledger.mainTab === 'accounts' ? <AccountsView /> : null}
          {ledger.mainTab === 'more' ? <MoreView /> : null}
        </div>
      </div>

      {ledger.showAdd ? <AddModal /> : null}
    </div>
  );
}

function Sidebar() {
  const ledger = useLedger();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">₹</span>
        <div>
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
            >
              <span className="ico">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-section sidebar-spacer">
        <span className="nav-label">Data</span>
        <div className="sidebar-actions">
          <button className="side-link" onClick={() => void ledger.refresh()}>
            <span className="ico">↻</span> Refresh
          </button>
          <button className="side-link" onClick={ledger.exportCsv}>
            <span className="ico">⬇</span> Export CSV
          </button>
          <ImportCsvButton />
          <button className="side-link danger" onClick={() => void ledger.resetAllData()}>
            <span className="ico">🗑</span> Erase all data
          </button>
        </div>
      </div>

      <div className="offline-pill">
        <span className="offline-dot" />
        Offline · saved on this device
      </div>
    </aside>
  );
}

function ImportCsvButton({ asCard = false }: { asCard?: boolean }) {
  const { importCsv } = useLedger();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importCsv(file);
        }}
      />
      {asCard ? (
        <button className="action-card" onClick={() => inputRef.current?.click()}>
          <span className="ac-ico">⬆️</span>
          <strong>Import CSV</strong>
          <span>Replace all data with a CSV backup (you'll confirm first).</span>
        </button>
      ) : (
        <button className="side-link" onClick={() => inputRef.current?.click()}>
          <span className="ico">⬆</span> Import CSV
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
        <MonthNav />
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
                  <div
                    key={day.date}
                    className={`calendar-cell ${day.inMonth ? '' : 'muted'} ${day.count ? 'has-data' : ''} ${day.date === today ? 'today' : ''}`}
                  >
                    <strong>{day.day}</strong>
                    {day.expense > 0 ? <em className="expense">-{day.expense.toFixed(0)}</em> : null}
                    {day.income > 0 ? <em className="income">+{day.income.toFixed(0)}</em> : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {homeView === 'weekly' ? (
            <>
              <h3>This week</h3>
              <div className="mini-stats">
                <p><span className="muted">Income</span> <span className="income">{formatMoney(weekSummary.income)}</span></p>
                <p><span className="muted">Expense</span> <span className="expense">{formatMoney(weekSummary.expense)}</span></p>
                <p><span className="muted">Net</span> <span className="balance">{formatMoney(weekSummary.balance)}</span></p>
              </div>
            </>
          ) : null}

          {homeView === 'monthly' ? (
            <>
              <h3>This month</h3>
              <div className="mini-stats">
                <p><span className="muted">Income</span> <span className="income">{formatMoney(monthSummary.income)}</span></p>
                <p><span className="muted">Expense</span> <span className="expense">{formatMoney(monthSummary.expense)}</span></p>
                <p><span className="muted">Net</span> <span className="balance">{formatMoney(monthSummary.balance)}</span></p>
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

          <div style={{ height: 18 }} />
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
                          <button className="icon-btn" title="Edit" onClick={() => startEdit(txn)}>✏️</button>
                          <button className="icon-btn danger" title="Delete" onClick={() => void deleteTransaction(txn)}>🗑</button>
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
  );
}

function Pie({ data }: { data: Array<{ category: string; amount: number; percent: number }> }) {
  const slices = categoryPieSlices(data, 200);
  const single = slices.length === 1 || slices[0]?.full;

  return (
    <div className="pie">
      <svg viewBox="0 0 200 200">
        {single ? (
          <circle cx="100" cy="100" r="100" fill={slices[0].color} />
        ) : (
          slices.map((slice) => <path key={slice.category} d={slice.path} fill={slice.color} />)
        )}
      </svg>
    </div>
  );
}

function StatsView() {
  const { transactions, selectedMonth } = useLedger();
  const [type, setType] = useState<TransactionType>('expense');
  const month = monthKey(selectedMonth);
  const summary = summarizeMonth(transactions, month);
  const breakdown = summarizeByCategory(transactions, month, type);
  const total = type === 'expense' ? summary.expense : summary.income;

  return (
    <div className="stack">
      <div className="view-bar">
        <MonthNav />
      </div>

      <div className="panel stats-panel">
        <div className="stats-tabs">
          <button
            className={type === 'income' ? 'stats-tab active' : 'stats-tab'}
            onClick={() => setType('income')}
          >
            <span>Income</span>
            {type === 'income' ? <strong className="income">{formatMoney(summary.income)}</strong> : null}
          </button>
          <button
            className={type === 'expense' ? 'stats-tab active' : 'stats-tab'}
            onClick={() => setType('expense')}
          >
            <span>Expenses</span>
            {type === 'expense' ? <strong className="expense">{formatMoney(summary.expense)}</strong> : null}
          </button>
        </div>

        {breakdown.length === 0 ? (
          <div className="empty"><span className="emoji">📊</span><span className="muted">No {type} data this month.</span></div>
        ) : (
          <>
            <div className="pie-hero">
              <Pie data={breakdown} />
            </div>
            <ul className="cat-legend">
              {breakdown.map((row) => {
                const meta = getCategoryMeta(row.category);
                return (
                  <li key={row.category}>
                    <span className="pct-badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                      {row.percent.toFixed(0)}%
                    </span>
                    <span className="cat-name">{meta.emoji} {row.category}</span>
                    <strong className="cat-amt">{formatMoney(row.amount)}</strong>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function AccountsView() {
  const { accounts, transactions, carryForward, selectedMonth } = useLedger();
  const month = monthKey(selectedMonth);
  const balances = computeAccountBalances(accounts, transactions, { carryForward, month });
  const total = balances.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="stack">
      <div className="hero-stat">
        <span>{carryForward ? 'Total balance (running)' : `Total balance · ${monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}`}</span>
        <strong className="balance">{formatMoney(total)}</strong>
      </div>
      <div className="account-grid">
        {balances.length === 0 ? (
          <div className="empty"><span className="emoji">🏦</span><span className="muted">No accounts yet.</span></div>
        ) : null}
        {balances.map((account) => (
          <article className="account-card" key={account.name}>
            <div className="acct-top">
              <span className="acct-badge">{account.name.slice(0, 1).toUpperCase()}</span>
              <h3>{account.name}</h3>
            </div>
            <strong className="acct-balance">{formatMoney(account.balance, account.currency)}</strong>
            <div className="acct-flows">
              <span className="income">+{formatMoney(account.income, account.currency)}</span>
              <span className="expense">-{formatMoney(account.expense, account.currency)}</span>
            </div>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Opening {formatMoney(account.openingBalance, account.currency)}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function MoreView() {
  const { budgets, transactions, selectedMonth, saveBudget, categories, exportCsv, resetAllData } = useLedger();
  const month = monthKey(selectedMonth);
  const progress = budgetProgressForMonth(budgets, transactions, month);
  const expenseCategories = categories.filter((c) => c.active && c.type === 'expense');

  return (
    <div className="stack">
      <SettingsPanel />

      <ManagePanel />

      <div className="panel">
        <h3>Backup &amp; restore</h3>
        <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.86rem', lineHeight: 1.5 }}>
          Your data lives only on this device. Export a CSV to back it up or open it in Excel. Importing a CSV
          replaces everything after you confirm.
        </p>
        <div className="action-cards">
          <button className="action-card" onClick={exportCsv}>
            <span className="ac-ico">⬇️</span>
            <strong>Export CSV</strong>
            <span>Download all transactions as an Excel-friendly file.</span>
          </button>
          <ImportCsvButton asCard />
          <button className="action-card danger" onClick={() => void resetAllData()}>
            <span className="ac-ico">🗑️</span>
            <strong>Erase all data</strong>
            <span>Reset this device to an empty ledger. Cannot be undone.</span>
          </button>
        </div>
      </div>

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
    </div>
  );
}

function SettingsPanel() {
  const { carryForward, setCarryForward, busy } = useLedger();

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

function CategoryManager() {
  const { categories, addCategory, deleteCategory } = useLedger();
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
        <span className="manage-label expense">Expense</span>
        <div className="tag-list">
          {expense.length === 0 ? <span className="muted">None yet.</span> : null}
          {expense.map((c) => (
            <span className="tag" key={c.name}>
              {getCategoryMeta(c.name).emoji} {c.name}
              <button className="tag-x" title="Remove" onClick={() => void deleteCategory(c.name)}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="manage-group">
        <span className="manage-label income">Income</span>
        <div className="tag-list">
          {income.length === 0 ? <span className="muted">None yet.</span> : null}
          {income.map((c) => (
            <span className="tag" key={c.name}>
              {getCategoryMeta(c.name).emoji} {c.name}
              <button className="tag-x" title="Remove" onClick={() => void deleteCategory(c.name)}>×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountManager() {
  const { accounts, transactions, addAccount, deleteAccount } = useLedger();
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
          <option value="INR">INR ₹</option>
          <option value="USD">USD $</option>
          <option value="EUR">EUR €</option>
          <option value="GBP">GBP £</option>
          <option value="JPY">JPY ¥</option>
        </select>
        <input type="number" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
        <button className="primary" onClick={() => void submit()} disabled={!name.trim()}>Add</button>
      </div>

      <div className="account-rows">
        {accounts.length === 0 ? <span className="muted">No accounts yet.</span> : null}
        {accounts.map((account) => {
          const balance = balances.find((b) => b.name === account.name)?.balance ?? account.openingBalance;
          return (
            <div className="account-row" key={account.name}>
              <span className="acct-badge sm">{account.name.slice(0, 1).toUpperCase()}</span>
              <div className="account-row-body">
                <strong>{account.name}</strong>
                <span className="muted">{account.currency} · opening {formatMoney(account.openingBalance, account.currency)}</span>
              </div>
              <strong className="balance">{formatMoney(balance, account.currency)}</strong>
              <button className="icon-btn danger" title="Remove account" onClick={() => void deleteAccount(account.name)}>🗑</button>
            </div>
          );
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

        <button type="button" className="amount-field tappable" onClick={() => setShowCalc(true)}>
          <span className="amount-label">Tap to enter amount with calculator</span>
          <p className={`amount-hero ${form.type}`}>
            {form.amount ? formatMoney(Number(form.amount), form.currency) : formatMoney(0, form.currency)}
          </p>
          <span className="calc-hint">🧮 Calculator</span>
        </button>

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
            {activeCategories.map((c) => (
              <button key={c.name} className={form.category === c.name ? 'chip active' : 'chip'} onClick={() => setForm({ ...form, category: c.name })}>
                {getCategoryMeta(c.name).emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label>Account</label>
          <div className="chips">
            {accounts.filter((a) => a.active).map((a) => (
              <button key={a.name} className={form.account === a.name ? 'chip active' : 'chip'} onClick={() => setForm({ ...form, account: a.name, currency: a.currency })}>
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
