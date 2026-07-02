import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import type { Transaction } from '../../../shared/finance';
import { formatMoney, formatSignedMoney, getCategoryMeta, groupTransactionsByDate } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Premium transaction browser: transactions grouped by day, each day rendered as
 * its own rounded card with a bold date header, daily total, and soft-divided rows.
 * Tapping a day header collapses/expands that day.
 */
export function TransactionGroups({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const groups = groupTransactionsByDate(transactions);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return <Text style={[styles.empty, { color: c.textMuted }]}>No transactions here yet. Tap + to add one.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => {
        const net = group.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
        const isCollapsed = collapsed[group.date];
        return (
          <View key={group.date} style={[styles.card, { backgroundColor: c.surface }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.head}
              onPress={() => setCollapsed((prev) => ({ ...prev, [group.date]: !prev[group.date] }))}
            >
              <Text style={[styles.dayNum, { color: c.text }]}>{group.parts.day}</Text>
              <View style={styles.headMeta}>
                <View style={[styles.weekPill, { backgroundColor: c.surface2 }]}>
                  <Text style={[styles.weekPillText, { color: c.textMuted }]}>
                    {group.parts.relative ?? group.parts.weekdayShort}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: c.textDim }]}>{group.parts.dateText}</Text>
              </View>
              <View style={styles.headRight}>
                <Text style={[styles.totalLabel, { color: c.textDim }]}>Daily total</Text>
                <Text style={[styles.total, { color: net >= 0 ? c.income : c.expense }]}>
                  {net >= 0 ? '+' : '-'}
                  {formatMoney(Math.abs(net))}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: c.textDim }]}>{isCollapsed ? '⌄' : '⌃'}</Text>
            </TouchableOpacity>

            {isCollapsed
              ? null
              : group.items.map((transaction, index) => {
                  const meta = getCategoryMeta(transaction.category);
                  const note = transaction.note?.trim();
                  const primary = note || transaction.category;
                  const secondary = note ? `${transaction.account} • ${transaction.category}` : transaction.account;
                  const isIncome = transaction.type === 'income';
                  return (
                    <View
                      key={transaction.id}
                      style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft }]}
                    >
                      <TouchableOpacity
                        style={styles.rowMain}
                        activeOpacity={0.7}
                        onPress={() => onEdit?.(transaction)}
                      >
                        <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                          <Text style={styles.emoji}>{meta.emoji}</Text>
                        </View>
                        <View style={styles.body}>
                          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                            {primary}
                          </Text>
                          <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={1}>
                            {secondary}
                          </Text>
                        </View>
                        <View style={styles.rowRight}>
                          <Text style={[styles.amount, { color: isIncome ? c.income : c.expense }]}>
                            {formatSignedMoney(transaction.amount, transaction.type, transaction.currency)}
                          </Text>
                          <View
                            style={[styles.typePill, { backgroundColor: isIncome ? c.incomeSoft : c.expenseSoft }]}
                          >
                            <Text style={[styles.typePillText, { color: isIncome ? c.income : c.expense }]}>
                              {isIncome ? 'Income' : 'Expense'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {onEdit || onDelete ? (
                        <View style={styles.actions}>
                          {onEdit ? (
                            <TouchableOpacity
                              hitSlop={8}
                              style={styles.actionBtn}
                              onPress={() => onEdit(transaction)}
                              accessibilityLabel="Edit transaction"
                            >
                              <Text style={[styles.actionIcon, { color: c.textDim }]}>✎</Text>
                            </TouchableOpacity>
                          ) : null}
                          {onDelete ? (
                            <TouchableOpacity
                              hitSlop={8}
                              style={styles.actionBtn}
                              onPress={() => onDelete(transaction)}
                              accessibilityLabel="Delete transaction"
                            >
                              <Text style={[styles.actionIcon, { color: c.textDim }]}>🗑</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    wrap: { gap: 16 },
    empty: { textAlign: 'center', paddingVertical: 36, fontSize: 14 },
    card: { borderRadius: 22, padding: 18 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dayNum: { fontSize: 30, fontWeight: '800', minWidth: 40, letterSpacing: -1 },
    headMeta: { flex: 1, gap: 4 },
    weekPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
    weekPillText: { fontSize: 12, fontWeight: '700' },
    dateText: { fontSize: 12, fontWeight: '500' },
    headRight: { alignItems: 'flex-end', gap: 2 },
    totalLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    total: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
    chevron: { fontSize: 16, width: 16, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 21 },
    body: { flex: 1, gap: 3 },
    title: { fontSize: 16, fontWeight: '600' },
    subtitle: { fontSize: 13, fontWeight: '500' },
    rowRight: { alignItems: 'flex-end', gap: 5 },
    amount: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
    typePill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
    typePillText: { fontSize: 10, fontWeight: '700' },
    actions: { flexDirection: 'column', gap: 6, paddingLeft: 10 },
    actionBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    actionIcon: { fontSize: 15 }
  });
