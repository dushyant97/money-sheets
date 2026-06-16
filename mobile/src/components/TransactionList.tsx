import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import type { Transaction } from '../../../shared/finance';
import { formatMoney, formatSignedMoney, getCategoryMeta, groupTransactionsByDate } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  showDateHeaders = true
}: {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  showDateHeaders?: boolean;
}) {
  const { palette: c } = useTheme();
  const groups = groupTransactionsByDate(transactions);

  if (groups.length === 0) {
    return <Text style={[styles.empty, { color: c.textMuted }]}>No transactions yet. Tap + to add one.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => {
        const net = group.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
        return (
          <View key={group.date}>
            {showDateHeaders ? (
              <View style={styles.dateHeader}>
                <View style={[styles.dayBadge, { backgroundColor: c.surfaceHover }]}>
                  <Text style={[styles.dayBadgeText, { color: c.text }]}>{group.parts.day}</Text>
                </View>
                <View style={styles.dateMeta}>
                  <Text style={[styles.dayPrimary, { color: c.text }]}>
                    {group.parts.relative ?? group.parts.weekday}
                  </Text>
                  <Text style={[styles.daySecondary, { color: c.textMuted }]}>
                    {group.parts.relative ? `${group.parts.weekday} · ${group.parts.dateText}` : group.parts.dateText}
                  </Text>
                </View>
                <Text style={[styles.dayNet, { color: net >= 0 ? c.income : c.expense }]}>
                  {net >= 0 ? '+' : '-'}
                  {formatMoney(Math.abs(net))}
                </Text>
              </View>
            ) : null}
            {group.items.map((transaction) => {
              const meta = getCategoryMeta(transaction.category);
              return (
                <TouchableOpacity
                  key={transaction.id}
                  style={[styles.row, { borderBottomColor: c.border }]}
                  onPress={() => onEdit?.(transaction)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.icon, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}33` }]}
                  >
                    <Text style={styles.emoji}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.body}>
                    <Text style={[styles.title, { color: c.text }]}>{transaction.category}</Text>
                    <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={1}>
                      {transaction.account}
                      {transaction.note ? ` · ${transaction.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.amount, { color: transaction.type === 'income' ? c.income : c.expense }]}>
                    {formatSignedMoney(transaction.amount, transaction.type, transaction.currency)}
                  </Text>
                  {onDelete ? (
                    <TouchableOpacity
                      onPress={() => onDelete(transaction)}
                      hitSlop={8}
                      style={styles.deleteBtn}
                      accessibilityLabel="Delete transaction"
                    >
                      <Text style={[styles.deleteIcon, { color: c.textDim }]}>🗑</Text>
                    </TouchableOpacity>
                  ) : null}
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
  empty: { textAlign: 'center', paddingVertical: 32 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 6, paddingHorizontal: 4 },
  dayBadge: { minWidth: 34, height: 34, paddingHorizontal: 6, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { fontWeight: '800', fontSize: 15 },
  dateMeta: { flex: 1 },
  dayPrimary: { fontWeight: '700', fontSize: 13 },
  daySecondary: { fontSize: 11 },
  dayNet: { fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700', fontSize: 15 },
  subtitle: { fontSize: 12 },
  amount: { fontWeight: '800', fontSize: 14 },
  deleteBtn: { paddingLeft: 8, paddingVertical: 4 },
  deleteIcon: { fontSize: 15 }
});
