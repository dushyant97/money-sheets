import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { radius, type ThemePalette } from '../../../shared/theme';
import { formatMoney } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

export function SummaryStrip({
  income,
  expense,
  balance,
  count,
  incomeSeries,
  expenseSeries,
  currency = 'INR'
}: {
  income: number;
  expense: number;
  balance: number;
  count?: number;
  incomeSeries?: number[];
  expenseSeries?: number[];
  currency?: string;
}) {
  const { palette: c } = useTheme();
  return (
    <View style={styles.wrap}>
      <SummaryTile label="Income" value={formatMoney(income, currency)} tone="income" c={c} series={incomeSeries} />
      <SummaryTile label="Expense" value={formatMoney(expense, currency)} tone="expense" c={c} series={expenseSeries} />
      <SummaryTile
        label="Balance"
        value={formatMoney(balance, currency)}
        tone="balance"
        c={c}
        sub={count !== undefined ? `${count} transaction${count === 1 ? '' : 's'}` : undefined}
      />
    </View>
  );
}

/** Small dependency-free trend line for a summary tile. */
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const width = 100;
  const height = 24;
  const data = values.length ? values : [0, 0];
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((value, index) => `${index * stepX},${height - ((value - min) / range) * (height - 3) - 1.5}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  c,
  series,
  sub
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'balance';
  c: ThemePalette;
  series?: number[];
  sub?: string;
}) {
  const toneColor = tone === 'income' ? c.income : tone === 'expense' ? c.expense : c.balance;
  return (
    <View
      style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: toneColor }]}
    >
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: toneColor }]} numberOfLines={1}>
        {value}
      </Text>
      {series ? (
        <View style={styles.spark}>
          <MiniSparkline values={series} color={toneColor} />
        </View>
      ) : sub ? (
        <Text style={[styles.sub, { color: c.textDim }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function PeriodPills<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { palette: c } = useTheme();
  return (
    <View style={styles.pills}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.pill,
              { backgroundColor: c.surface, borderColor: 'transparent' },
              active && { backgroundColor: c.accentSoft, borderColor: c.accent }
            ]}
            onPress={() => onChange(option.id)}
          >
            <Text style={[styles.pillText, { color: active ? c.accentText : c.textMuted }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 5
  },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: '800' },
  spark: { height: 24, marginTop: 2 },
  sub: { fontSize: 10, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' }
});
