import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import type { Transaction } from '../../../shared/finance';
import { formatMoney, formatSignedMoney, getCategoryMeta, groupTransactionsByDate } from '../../../shared/uiHelpers';

export function TransactionList({
  transactions,
  onPress,
  onLongPress
}: {
  transactions: Transaction[];
  onPress?: (transaction: Transaction) => void;
  onLongPress?: (transaction: Transaction) => void;
}) {
  const groups = groupTransactionsByDate(transactions);

  if (groups.length === 0) {
    return <Text style={styles.empty}>No transactions yet. Tap + to add one.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => {
        const net = group.items.reduce(
          (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
          0
        );
        return (
        <View key={group.date}>
          <View style={styles.dateHeader}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{group.parts.day}</Text>
            </View>
            <View style={styles.dateMeta}>
              <Text style={styles.dayPrimary}>{group.parts.relative ?? group.parts.weekday}</Text>
              <Text style={styles.daySecondary}>
                {group.parts.relative ? `${group.parts.weekday} · ${group.parts.dateText}` : group.parts.dateText}
              </Text>
            </View>
            <Text style={[styles.dayNet, net >= 0 ? styles.income : styles.expense]}>
              {net >= 0 ? '+' : '-'}
              {formatMoney(Math.abs(net))}
            </Text>
          </View>
          {group.items.map((transaction) => {
            const meta = getCategoryMeta(transaction.category);
            return (
              <TouchableOpacity
                key={transaction.id}
                style={styles.row}
                onPress={() => onPress?.(transaction)}
                onLongPress={() => onLongPress?.(transaction)}
                activeOpacity={0.7}
              >
                <View style={[styles.icon, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}33` }]}>
                  <Text style={styles.emoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{transaction.category}</Text>
                  <Text style={styles.subtitle}>
                    {transaction.account}
                    {transaction.note ? ` · ${transaction.note}` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amount,
                    transaction.type === 'income' ? styles.income : styles.expense
                  ]}
                >
                  {formatSignedMoney(transaction.amount, transaction.type, transaction.currency)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 32 },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4
  },
  dayBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayBadgeText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  dateMeta: { flex: 1 },
  dayPrimary: { color: colors.text, fontWeight: '700', fontSize: 13 },
  daySecondary: { color: colors.textMuted, fontSize: 11 },
  dayNet: { fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emoji: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  subtitle: { color: colors.textMuted, fontSize: 12 },
  amount: { fontWeight: '800', fontSize: 14 },
  income: { color: colors.income },
  expense: { color: colors.expense }
});
