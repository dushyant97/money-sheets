import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { formatMoney } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

export function SummaryStrip({
  income,
  expense,
  balance,
  currency = 'INR'
}: {
  income: number;
  expense: number;
  balance: number;
  currency?: string;
}) {
  const { palette: c } = useTheme();
  return (
    <View style={styles.wrap}>
      <SummaryTile label="Income" value={formatMoney(income, currency)} tone="income" c={c} />
      <SummaryTile label="Expense" value={formatMoney(expense, currency)} tone="expense" c={c} />
      <SummaryTile label="Balance" value={formatMoney(balance, currency)} tone="balance" c={c} />
    </View>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  c
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'balance';
  c: ThemePalette;
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
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' }
});
