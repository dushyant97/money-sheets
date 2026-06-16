import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import type { Transaction } from '../../../shared/finance';
import { dateLabelParts, formatMoney } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';
import { TransactionList } from './TransactionList';

/** Popup listing a single day's transactions (income + expense) with actions. */
export function DayTransactionsModal({
  date,
  transactions,
  onEdit,
  onDelete,
  onClose
}: {
  date: string | null;
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onClose: () => void;
}) {
  const { palette: c } = useTheme();
  const visible = date !== null;
  const parts = date ? dateLabelParts(date) : null;
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.head}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>{parts ? parts.dateText : ''}</Text>
              <Text style={[styles.sub, { color: c.textMuted }]}>
                {parts ? parts.weekday : ''} · {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={[styles.close, { color: c.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.totals}>
            <Text style={[styles.total, { color: c.income }]}>+{formatMoney(income)}</Text>
            <Text style={[styles.total, { color: c.expense }]}>-{formatMoney(expense)}</Text>
          </View>

          <ScrollView style={styles.scroll}>
            {transactions.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>Nothing recorded on this day.</Text>
            ) : (
              <TransactionList
                transactions={transactions}
                showDateHeaders={false}
                onEdit={(t) => {
                  onClose();
                  onEdit(t);
                }}
                onDelete={onDelete}
              />
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, maxHeight: '80%', borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  close: { fontSize: 18, fontWeight: '700' },
  totals: { flexDirection: 'row', gap: 16 },
  total: { fontSize: 14, fontWeight: '800' },
  scroll: { maxHeight: 420 },
  empty: { textAlign: 'center', paddingVertical: 24 }
});
