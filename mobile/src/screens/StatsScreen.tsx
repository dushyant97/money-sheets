import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, radius } from '../../../shared/theme';
import type { TransactionType } from '../../../shared/finance';
import { monthKey, summarizeByCategory, summarizeMonth } from '../../../shared/finance';
import { categoryPieSlices, formatMoney } from '../../../shared/uiHelpers';
import { useLedger } from '../context/LedgerContext';

const CHART_SIZE = 220;

export function StatsScreen() {
  const { transactions, selectedMonth, setSelectedMonth } = useLedger();
  const month = monthKey(selectedMonth);
  const [type, setType] = useState<TransactionType>('expense');

  const summary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const breakdown = useMemo(
    () => summarizeByCategory(transactions, month, type),
    [transactions, month, type]
  );
  const slices = useMemo(() => categoryPieSlices(breakdown, CHART_SIZE), [breakdown]);
  const total = type === 'expense' ? summary.expense : summary.income;

  function shiftMonth(delta: number) {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + delta);
    setSelectedMonth(next);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {selectedMonth.toLocaleString('default', { month: 'short', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['income', 'expense'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={styles.tab}
            onPress={() => setType(value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, type === value && styles.tabTextActive]}>
              {value === 'income' ? 'Income' : 'Expenses'}
            </Text>
            {type === value ? (
              <Text style={[styles.tabAmount, value === 'income' ? styles.income : styles.expense]}>
                {formatMoney(total)}
              </Text>
            ) : null}
            <View style={[styles.tabUnderline, type === value && styles.tabUnderlineActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {slices.length === 0 ? (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.empty}>No {type} data this month.</Text>
        </View>
      ) : (
        <>
          <View style={styles.chartWrap}>
            <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
              {slices.length === 1 || slices[0]?.full ? (
                <Circle cx={CHART_SIZE / 2} cy={CHART_SIZE / 2} r={CHART_SIZE / 2} fill={slices[0].color} />
              ) : (
                slices.map((slice) => <Path key={slice.category} d={slice.path} fill={slice.color} />)
              )}
            </Svg>
          </View>

          <View style={styles.list}>
            {slices.map((slice) => (
              <View style={styles.legendRow} key={slice.category}>
                <View style={[styles.percentBadge, { backgroundColor: `${slice.color}22` }]}>
                  <Text style={[styles.percentText, { color: slice.color }]}>{slice.percent.toFixed(0)}%</Text>
                </View>
                <Text style={styles.legendName} numberOfLines={1}>
                  {slice.emoji} {slice.category}
                </Text>
                <Text style={styles.legendAmount}>{formatMoney(slice.amount)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  navArrow: { color: colors.text, fontSize: 26, fontWeight: '700', paddingHorizontal: 8 },
  monthLabel: { color: colors.text, fontSize: 17, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: colors.text },
  tabAmount: { fontSize: 13, fontWeight: '800' },
  tabUnderline: { height: 2, width: '70%', backgroundColor: 'transparent', borderRadius: 2, marginTop: 2 },
  tabUnderlineActive: { backgroundColor: colors.accent2 },
  income: { color: colors.income },
  expense: { color: colors.expense },
  chartWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  emptyChart: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyEmoji: { fontSize: 40 },
  empty: { color: colors.textMuted },
  list: { gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  percentBadge: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  percentText: { fontWeight: '800', fontSize: 12 },
  legendName: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 },
  legendAmount: { color: colors.text, fontWeight: '700', fontSize: 14 }
});
