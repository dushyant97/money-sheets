import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import { formatMoney } from '../../../shared/uiHelpers';

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
  return (
    <View style={styles.wrap}>
      <SummaryTile label="Income" value={formatMoney(income, currency)} tone="income" />
      <SummaryTile label="Expense" value={formatMoney(expense, currency)} tone="expense" />
      <SummaryTile label="Balance" value={formatMoney(balance, currency)} tone="balance" />
    </View>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'balance';
}) {
  const toneColor = tone === 'income' ? colors.income : tone === 'expense' ? colors.expense : colors.balance;

  return (
    <View style={[styles.tile, { borderLeftColor: toneColor }]}>
      <Text style={styles.label}>{label}</Text>
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
  return (
    <View style={styles.pills}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.pill, value === option.id && styles.pillActive]}
          onPress={() => onChange(option.id)}
        >
          <Text style={[styles.pillText, value === option.id && styles.pillTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8
  },
  tile: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 5
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  value: {
    fontSize: 14,
    fontWeight: '800'
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap'
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700'
  },
  pillTextActive: {
    color: colors.accentText
  }
});
