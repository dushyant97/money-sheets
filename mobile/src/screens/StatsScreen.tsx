import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { radius, type ThemePalette } from '../../../shared/theme';
import type { TransactionType, TrendGranularity } from '../../../shared/finance';
import { buildCategoryTrends, monthKey, summarizeByCategory, summarizeMonth } from '../../../shared/finance';
import { categoryRingArcs, chartColorAt, formatMoney } from '../../../shared/uiHelpers';
import { LineChart } from '../components/LineChart';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

const RING_SIZE = 220;
const RING_THICKNESS = 26;

const GRANULARITIES: Array<{ id: TrendGranularity; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' }
];

export function StatsScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { transactions, selectedMonth, categories } = useLedger();
  const month = monthKey(selectedMonth);

  const [tab, setTab] = useState<'breakdown' | 'trends'>('breakdown');
  const [type, setType] = useState<TransactionType>('expense');
  const [granularity, setGranularity] = useState<TrendGranularity>('month');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const summary = useMemo(() => summarizeMonth(transactions, month), [transactions, month]);
  const prevSummary = useMemo(() => {
    const prev = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
    return summarizeMonth(transactions, monthKey(prev));
  }, [transactions, selectedMonth]);

  const breakdown = useMemo(() => summarizeByCategory(transactions, month, type), [transactions, month, type]);
  const ringColors = useMemo(() => breakdown.map((_, index) => chartColorAt(index)), [breakdown]);
  const arcs = useMemo(
    () => categoryRingArcs(breakdown, { size: RING_SIZE, thickness: RING_THICKNESS, colors: ringColors }),
    [breakdown, ringColors]
  );
  const total = type === 'expense' ? summary.expense : summary.income;

  const categoryNames = useMemo(
    () => categories.filter((cat) => cat.type === type).map((cat) => cat.name),
    [categories, type]
  );
  const trend = useMemo(
    () =>
      buildCategoryTrends(transactions, {
        granularity,
        type,
        endDate: selectedMonth,
        topN: 6,
        categoryNames
      }),
    [transactions, granularity, type, selectedMonth, categoryNames]
  );
  const visibleTrend = useMemo(
    () => ({ ...trend, categories: trend.categories.filter((series) => !hidden.has(series.category)) }),
    [trend, hidden]
  );

  const net = summary.income - summary.expense;
  const prevNet = prevSummary.income - prevSummary.expense;
  const savingsRate = summary.income > 0 ? (net / summary.income) * 100 : 0;
  const prevSavingsRate = prevSummary.income > 0 ? (prevNet / prevSummary.income) * 100 : 0;

  function toggleHidden(category: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <ScrollView style={[styles.screen]} contentContainerStyle={styles.content}>
      <View style={styles.segment}>
        {(['breakdown', 'trends'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.segmentBtn, tab === value && styles.segmentBtnActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.segmentText, tab === value && styles.segmentTextActive]}>
              {value === 'breakdown' ? 'Breakdown' : 'Trends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.kpiRow}>
        <Kpi label="Income" value={formatMoney(summary.income)} prev={prevSummary.income} cur={summary.income} tone={c.income} c={c} />
        <Kpi label="Expense" value={formatMoney(summary.expense)} prev={prevSummary.expense} cur={summary.expense} tone={c.expense} invert c={c} />
      </View>
      <View style={styles.kpiRow}>
        <Kpi label="Net balance" value={formatMoney(net)} prev={prevNet} cur={net} tone={c.balance} c={c} />
        <Kpi
          label="Savings rate"
          value={`${savingsRate.toFixed(0)}%`}
          prev={prevSavingsRate}
          cur={savingsRate}
          tone={c.accent}
          c={c}
        />
      </View>

      <View style={styles.typeToggle}>
        {(['expense', 'income'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.typeBtn, type === value && styles.typeBtnActive]}
            onPress={() => setType(value)}
          >
            <Text style={[styles.typeText, type === value && styles.typeTextActive]}>
              {value === 'income' ? 'Income' : 'Expenses'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'breakdown' ? (
        breakdown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No {type} data this month.</Text>
          </View>
        ) : (
          <>
            <View style={styles.ringWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {arcs.map((arc) => {
                  const dim = highlight !== null && highlight !== arc.category;
                  if (arc.full) {
                    return (
                      <Circle
                        key={arc.category}
                        cx={RING_SIZE / 2}
                        cy={RING_SIZE / 2}
                        r={(RING_SIZE - RING_THICKNESS) / 2}
                        stroke={arc.color}
                        strokeWidth={RING_THICKNESS}
                        fill="none"
                        opacity={dim ? 0.25 : 1}
                      />
                    );
                  }
                  return (
                    <Path
                      key={arc.category}
                      d={arc.path}
                      stroke={arc.color}
                      strokeWidth={highlight === arc.category ? RING_THICKNESS + 6 : RING_THICKNESS}
                      strokeLinecap="round"
                      fill="none"
                      opacity={dim ? 0.25 : 1}
                    />
                  );
                })}
              </Svg>
              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={styles.ringTotalLabel}>{type === 'expense' ? 'Spent' : 'Earned'}</Text>
                <Text style={styles.ringTotal}>{formatMoney(total)}</Text>
              </View>
            </View>

            <View style={styles.list}>
              {arcs.map((arc) => {
                const active = highlight === arc.category;
                return (
                  <TouchableOpacity
                    key={arc.category}
                    style={[styles.legendRow, active && { backgroundColor: c.surface2, borderRadius: radius.sm }]}
                    onPress={() => setHighlight(active ? null : arc.category)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.swatch, { backgroundColor: arc.color }]} />
                    <Text style={styles.legendName} numberOfLines={1}>
                      {arc.emoji} {arc.category}
                    </Text>
                    <Text style={[styles.legendPct, { color: c.textMuted }]}>{arc.percent.toFixed(0)}%</Text>
                    <Text style={styles.legendAmount}>{formatMoney(arc.amount)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )
      ) : (
        <>
          <View style={styles.granRow}>
            {GRANULARITIES.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.granPill, granularity === option.id && styles.granPillActive]}
                onPress={() => setGranularity(option.id)}
              >
                <Text style={[styles.granText, granularity === option.id && styles.granTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chartCard}>
            <LineChart trend={visibleTrend} colorFor={(category) => colorForCategory(trend.categories.map((s) => s.category), category)} />
          </View>

          <View style={styles.legendWrap}>
            {trend.categories.map((series) => {
              const color = colorForCategory(trend.categories.map((s) => s.category), series.category);
              const shown = !hidden.has(series.category);
              return (
                <TouchableOpacity
                  key={series.category}
                  style={[styles.trendLegend, { borderColor: c.border }, !shown && { opacity: 0.4 }]}
                  onPress={() => toggleHidden(series.category)}
                >
                  <View style={[styles.swatch, { backgroundColor: color }]} />
                  <Text style={styles.trendLegendText} numberOfLines={1}>
                    {series.category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Stable color per category by its rank in the full (unfiltered) series list. */
function colorForCategory(orderedCategories: string[], category: string): string {
  const index = orderedCategories.indexOf(category);
  return chartColorAt(index < 0 ? 0 : index);
}

function Kpi({
  label,
  value,
  prev,
  cur,
  tone,
  invert,
  c
}: {
  label: string;
  value: string;
  prev: number;
  cur: number;
  tone: string;
  invert?: boolean;
  c: ThemePalette;
}) {
  const diff = cur - prev;
  const hasDelta = prev !== 0 || cur !== 0;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : cur !== 0 ? 100 : 0;
  // For expenses, a decrease is "good" (green); invert flips the color meaning.
  const good = invert ? diff <= 0 : diff >= 0;
  const deltaColor = !hasDelta || diff === 0 ? c.textDim : good ? c.income : c.expense;

  return (
    <View style={[kpiStyles.card, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: tone }]}>
      <Text style={[kpiStyles.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[kpiStyles.value, { color: c.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[kpiStyles.delta, { color: deltaColor }]}>
        {diff === 0 || !hasDelta ? '—' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs last`}
      </Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderLeftWidth: 3, padding: 12, gap: 4 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  delta: { fontSize: 10, fontWeight: '700' }
});

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 120, gap: 14 },
    segment: { flexDirection: 'row', gap: 6, backgroundColor: c.surface2, borderRadius: radius.pill, padding: 4 },
    segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
    segmentBtnActive: { backgroundColor: c.accent },
    segmentText: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
    segmentTextActive: { color: '#fff' },
    kpiRow: { flexDirection: 'row', gap: 10 },
    typeToggle: { flexDirection: 'row', gap: 8 },
    typeBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'transparent'
    },
    typeBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    typeText: { color: c.textMuted, fontWeight: '800', fontSize: 13 },
    typeTextActive: { color: c.accentText },
    ringWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    ringCenter: { position: 'absolute', alignItems: 'center' },
    ringTotalLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    ringTotal: { color: c.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    list: { gap: 2 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 6 },
    swatch: { width: 12, height: 12, borderRadius: 4 },
    legendName: { flex: 1, color: c.text, fontWeight: '600', fontSize: 14 },
    legendPct: { fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' },
    legendAmount: { color: c.text, fontWeight: '700', fontSize: 14, minWidth: 70, textAlign: 'right' },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyEmoji: { fontSize: 40 },
    emptyText: { color: c.textMuted },
    granRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
    granPill: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'transparent'
    },
    granPillActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    granText: { color: c.textMuted, fontWeight: '700', fontSize: 12 },
    granTextActive: { color: c.accentText },
    chartCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: 12 },
    legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    trendLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1
    },
    trendLegendText: { color: c.text, fontWeight: '600', fontSize: 12, maxWidth: 110 }
  });
