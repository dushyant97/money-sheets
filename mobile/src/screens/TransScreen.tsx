import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import {
  buildCalendarMonth,
  carryOverBalance,
  filterTransactions,
  monthKey,
  summarizeByCategory,
  summarizeMonth,
  summarizeWeek,
  transactionsInMonth
} from '../../../shared/finance';
import { formatMoney, monthTitle } from '../../../shared/uiHelpers';
import { PeriodPills, SummaryStrip } from '../components/SummaryStrip';
import { TransactionList } from '../components/TransactionList';
import { useLedger } from '../context/LedgerContext';

const HOME_VIEWS = [
  { id: 'calendar' as const, label: 'Calendar' },
  { id: 'weekly' as const, label: 'Weekly' },
  { id: 'monthly' as const, label: 'Monthly' },
  { id: 'summary' as const, label: 'Summary' }
];

export function TransScreen() {
  const {
    transactions,
    accounts,
    carryForward,
    filters,
    homeView,
    selectedMonth,
    setHomeView,
    setSelectedMonth,
    startEdit,
    deleteTransaction
  } = useLedger();

  const month = monthKey(selectedMonth);
  const monthSummary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const weekSummary = useMemo(() => summarizeWeek(transactions), [transactions]);
  const filtered = useMemo(
    () => filterTransactions(transactionsInMonth(transactions, month), filters),
    [transactions, month, filters]
  );
  const broughtForward = useMemo(
    () => (carryForward ? carryOverBalance(accounts, transactions, month, true) : 0),
    [accounts, transactions, month, carryForward]
  );
  const calendarDays = useMemo(
    () => buildCalendarMonth(transactions, selectedMonth.getFullYear(), selectedMonth.getMonth()),
    [transactions, selectedMonth]
  );
  const expenseBreakdown = useMemo(
    () => summarizeByCategory(transactions, month, 'expense'),
    [transactions, month]
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  function shiftMonth(delta: number) {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + delta, 1));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shiftMonth(-1)}>
          <Text style={styles.navBtn}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>Trans.</Text>
          <Text style={styles.monthLabel}>{monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}</Text>
        </View>
        <TouchableOpacity onPress={() => shiftMonth(1)}>
          <Text style={styles.navBtn}>›</Text>
        </TouchableOpacity>
      </View>

      <PeriodPills options={HOME_VIEWS} value={homeView} onChange={setHomeView} />

      <SummaryStrip
        income={homeView === 'weekly' ? weekSummary.income : monthSummary.income}
        expense={homeView === 'weekly' ? weekSummary.expense : monthSummary.expense}
        balance={homeView === 'weekly' ? weekSummary.balance : monthSummary.balance + broughtForward}
      />
      {carryForward && homeView !== 'weekly' && broughtForward !== 0 ? (
        <Text style={styles.carryNote}>Includes {formatMoney(broughtForward)} brought forward</Text>
      ) : null}

      {homeView === 'calendar' ? (
        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.calendarCell,
                  !day.inMonth && styles.calendarCellMuted,
                  day.count > 0 && styles.calendarCellActive,
                  day.date === todayKey && styles.calendarCellToday
                ]}
              >
                <Text style={styles.calendarDay}>{day.day}</Text>
                <View style={styles.dotRow}>
                  {day.expense > 0 ? <View style={[styles.dot, styles.dotExpense]} /> : null}
                  {day.income > 0 ? <View style={[styles.dot, styles.dotIncome]} /> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {homeView === 'weekly' ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>This week</Text>
          <Text style={styles.infoText}>{weekSummary.label}</Text>
          <Text style={styles.infoText}>{weekSummary.count} transaction(s)</Text>
        </View>
      ) : null}

      {homeView === 'monthly' ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Monthly comparison</Text>
          <Text style={[styles.infoAmount, styles.income]}>Income {formatMoney(monthSummary.income)}</Text>
          <Text style={[styles.infoAmount, styles.expense]}>Expense {formatMoney(monthSummary.expense)}</Text>
        </View>
      ) : null}

      {homeView === 'summary' ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Top expense categories</Text>
          {expenseBreakdown.slice(0, 5).map((row) => (
            <View style={styles.summaryRow} key={row.category}>
              <Text style={styles.summaryLabel}>{row.category}</Text>
              <Text style={styles.summaryValue}>{formatMoney(row.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TransactionList
        transactions={filtered}
        onPress={startEdit}
        onLongPress={(transaction) => void deleteTransaction(transaction)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerCenter: { alignItems: 'center' },
  screenTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  monthLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  navBtn: { color: colors.textMuted, fontSize: 26, paddingHorizontal: 12, fontWeight: '400' },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8
  },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekday: { color: colors.textDim, fontSize: 11, fontWeight: '800', width: 28, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  calendarCellMuted: { opacity: 0.32 },
  calendarCellActive: { backgroundColor: colors.bgElevated },
  calendarCellToday: { borderColor: colors.accent },
  calendarDay: { color: colors.text, fontSize: 12, fontWeight: '600' },
  dotRow: { flexDirection: 'row', gap: 3, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotExpense: { backgroundColor: colors.expense },
  dotIncome: { backgroundColor: colors.income },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6
  },
  infoTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  infoText: { color: colors.textMuted, fontSize: 13 },
  infoAmount: { fontSize: 14, fontWeight: '700' },
  income: { color: colors.income },
  expense: { color: colors.expense },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: colors.textMuted },
  summaryValue: { color: colors.text, fontWeight: '700' },
  carryNote: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: -8 }
});
