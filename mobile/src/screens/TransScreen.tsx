import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import type { TransactionType } from '../../../shared/finance';
import {
  activeTransactions,
  buildCalendarMonth,
  carryOverBalance,
  dailySeries,
  dateKey,
  filterTransactions,
  monthKey,
  summarizeByCategory,
  summarizeMonth,
  summarizeWeek,
  transactionsInMonth
} from '../../../shared/finance';
import { formatMoney } from '../../../shared/uiHelpers';
import { PeriodPills, SummaryStrip } from '../components/SummaryStrip';
import { TransactionList } from '../components/TransactionList';
import { DayTransactionsModal } from '../components/DayTransactionsModal';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

const HOME_VIEWS = [
  { id: 'calendar' as const, label: 'Calendar' },
  { id: 'summary' as const, label: 'Summary' }
];

const TYPE_FILTERS: Array<{ id: TransactionType | 'all'; label: string }> = [
  { id: 'all', label: 'All categories' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' }
];

const DURATIONS = [
  { id: 'all' as const, label: 'All' },
  { id: 'currentMonth' as const, label: 'Current month' }
];

const RECENT_LIMIT = 8;

export function TransScreen() {
  const { palette: c } = useTheme();
  const {
    transactions,
    accounts,
    carryForward,
    filters,
    setFilters,
    homeView,
    selectedMonth,
    setHomeView,
    startEdit,
    deleteTransaction
  } = useLedger();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [duration, setDuration] = useState<'all' | 'currentMonth'>('currentMonth');
  const [showAll, setShowAll] = useState(false);
  const month = monthKey(selectedMonth);

  const monthSummary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const weekSummary = useMemo(() => summarizeWeek(transactions), [transactions]);
  const series = useMemo(() => dailySeries(transactions, month), [transactions, month]);
  const filtered = useMemo(() => {
    const scoped = duration === 'currentMonth' ? transactionsInMonth(transactions, month) : transactions;
    return filterTransactions(scoped, filters);
  }, [transactions, month, filters, duration]);
  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered]
  );
  const visibleTransactions = showAll ? sortedFiltered : sortedFiltered.slice(0, RECENT_LIMIT);
  const broughtForward = useMemo(
    () => (carryForward ? carryOverBalance(accounts, transactions, month, true) : 0),
    [accounts, transactions, month, carryForward]
  );
  const calendarDays = useMemo(
    () => buildCalendarMonth(transactions, selectedMonth.getFullYear(), selectedMonth.getMonth()),
    [transactions, selectedMonth]
  );
  const expenseBreakdown = useMemo(() => summarizeByCategory(transactions, month, 'expense'), [transactions, month]);
  const dayTransactions = useMemo(
    () => (selectedDay ? activeTransactions(transactions).filter((t) => t.date === selectedDay) : []),
    [transactions, selectedDay]
  );

  const todayKey = dateKey();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <PeriodPills options={HOME_VIEWS} value={homeView} onChange={setHomeView} />

      <SummaryStrip
        income={homeView === 'weekly' ? weekSummary.income : monthSummary.income}
        expense={homeView === 'weekly' ? weekSummary.expense : monthSummary.expense}
        balance={homeView === 'weekly' ? weekSummary.balance : monthSummary.balance + broughtForward}
        count={monthSummary.count}
        incomeSeries={series.income}
        expenseSeries={series.expense}
      />
      {carryForward && homeView !== 'weekly' && broughtForward !== 0 ? (
        <Text style={[styles.carryNote, { color: c.textDim }]}>
          Includes {formatMoney(broughtForward)} brought forward
        </Text>
      ) : null}

      {homeView === 'calendar' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.weekdayRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={[styles.weekday, { color: c.textDim }]}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => (
              <TouchableOpacity
                key={day.date}
                disabled={day.count === 0}
                onPress={() => setSelectedDay(day.date)}
                style={[
                  styles.calendarCell,
                  !day.inMonth && styles.calendarCellMuted,
                  day.count > 0 && { backgroundColor: c.bgElevated },
                  day.date === todayKey && { borderColor: c.accent, borderWidth: 1 }
                ]}
              >
                <Text style={[styles.calendarDay, { color: c.text }]}>{day.day}</Text>
                <View style={styles.dotRow}>
                  {day.expense > 0 ? <View style={[styles.dot, { backgroundColor: c.expense }]} /> : null}
                  {day.income > 0 ? <View style={[styles.dot, { backgroundColor: c.income }]} /> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {homeView === 'monthly' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Monthly comparison</Text>
          <Text style={[styles.infoAmount, { color: c.income }]}>Income {formatMoney(monthSummary.income)}</Text>
          <Text style={[styles.infoAmount, { color: c.expense }]}>Expense {formatMoney(monthSummary.expense)}</Text>
        </View>
      ) : null}

      {homeView === 'summary' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Top expense categories</Text>
          {expenseBreakdown.slice(0, 5).map((row) => (
            <View style={styles.summaryRow} key={row.category}>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>{row.category}</Text>
              <Text style={[styles.summaryValue, { color: c.text }]}>{formatMoney(row.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Filters live in their own card, separate from the calendar above. */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardLabel, { color: c.textDim }]}>FILTERS</Text>
        <View style={styles.typeRow}>
          {TYPE_FILTERS.map((option) => {
            const active = (filters.type ?? 'all') === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.typePill,
                  { backgroundColor: c.surface2, borderColor: 'transparent' },
                  active && { backgroundColor: c.accentSoft, borderColor: c.accent }
                ]}
                onPress={() => setFilters({ ...filters, type: option.id })}
              >
                <Text style={[styles.typePillText, { color: active ? c.accentText : c.textMuted }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[styles.search, { backgroundColor: c.bgElevated, borderColor: c.border, color: c.text }]}
          value={filters.search ?? ''}
          onChangeText={(search) => setFilters({ ...filters, search })}
          placeholder="Search notes, category, amount…"
          placeholderTextColor={c.textDim}
          autoCapitalize="none"
        />
        <Text style={[styles.cardLabel, { color: c.textDim, marginTop: 4 }]}>DURATION</Text>
        <View style={styles.typeRow}>
          {DURATIONS.map((option) => {
            const active = duration === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.typePill,
                  { backgroundColor: c.surface2, borderColor: 'transparent' },
                  active && { backgroundColor: c.accentSoft, borderColor: c.accent }
                ]}
                onPress={() => setDuration(option.id)}
              >
                <Text style={[styles.typePillText, { color: active ? c.accentText : c.textMuted }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.recentHead}>
        <Text style={[styles.cardLabel, { color: c.textDim }]}>RECENT TRANSACTIONS</Text>
        {sortedFiltered.length > RECENT_LIMIT ? (
          <TouchableOpacity onPress={() => setShowAll((s) => !s)}>
            <Text style={[styles.viewAll, { color: c.accentText }]}>{showAll ? 'Show less' : 'View all'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TransactionList transactions={visibleTransactions} onEdit={startEdit} onDelete={(t) => void deleteTransaction(t)} />

      <DayTransactionsModal
        date={selectedDay}
        transactions={dayTransactions}
        onEdit={startEdit}
        onDelete={(t) => void deleteTransaction(t)}
        onClose={() => setSelectedDay(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 8 },
  cardTitle: { fontWeight: '800', fontSize: 15 },
  cardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekday: { fontSize: 11, fontWeight: '800', width: 28, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.sm,
    borderColor: 'transparent'
  },
  calendarCellMuted: { opacity: 0.32 },
  calendarDay: { fontSize: 12, fontWeight: '600' },
  dotRow: { flexDirection: 'row', gap: 3, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  infoAmount: { fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: {},
  summaryValue: { fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  search: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  carryNote: { fontSize: 11, textAlign: 'center', marginTop: -8 },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
  viewAll: { fontSize: 12, fontWeight: '800' }
});
