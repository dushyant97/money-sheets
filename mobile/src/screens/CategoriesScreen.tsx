import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { filterTransactions, monthKey, transactionsInMonth } from '../../../shared/finance';
import { formatMoney, getCategoryMeta } from '../../../shared/uiHelpers';
import { EntityEditorModal } from '../components/EntityEditorModal';
import { TransactionList } from '../components/TransactionList';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

export function CategoriesScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { categories, transactions, selectedMonth, updateCategory, startEdit, deleteTransaction } = useLedger();

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);
  const [selected, setSelected] = useState<string>(activeCategories[0]?.name ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!activeCategories.some((category) => category.name === selected)) {
      setSelected(activeCategories[0]?.name ?? '');
    }
  }, [activeCategories, selected]);

  const month = monthKey(selectedMonth);
  const meta = getCategoryMeta(selected);
  const rows = useMemo(
    () => filterTransactions(transactionsInMonth(transactions, month), { category: selected }),
    [transactions, month, selected]
  );
  const total = rows.reduce((sum, t) => sum + t.amount, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.pickerWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {activeCategories.map((category) => {
            const m = getCategoryMeta(category.name);
            const active = selected === category.name;
            return (
              <TouchableOpacity
                key={category.name}
                style={[
                  styles.pickChip,
                  { backgroundColor: active ? `${m.color}22` : c.surface, borderColor: active ? m.color : 'transparent' }
                ]}
                onPress={() => setSelected(category.name)}
              >
                <Text style={styles.pickEmoji}>{m.emoji}</Text>
                <Text style={[styles.pickText, { color: active ? c.text : c.textMuted }]} numberOfLines={1}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {selected ? (
        <>
          <View style={[styles.hero, { backgroundColor: `${meta.color}1a`, borderColor: `${meta.color}55` }]}>
            <View style={[styles.heroIcon, { backgroundColor: `${meta.color}33` }]}>
              <Text style={styles.heroEmoji}>{meta.emoji}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{selected}</Text>
              <Text style={styles.heroMeta}>
                {rows.length} transaction{rows.length === 1 ? '' : 's'} this month
              </Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroTotal}>{formatMoney(total)}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TransactionList
            transactions={rows}
            showDateHeaders={false}
            onEdit={startEdit}
            onDelete={(t) => void deleteTransaction(t)}
          />
        </>
      ) : (
        <Text style={styles.empty}>No categories yet. Add some from the More tab.</Text>
      )}

      <EntityEditorModal
        visible={editing}
        title={`Edit ${selected}`}
        initial={{ name: selected, emoji: meta.emoji, color: meta.color }}
        onClose={() => setEditing(false)}
        onSave={(value) => {
          void updateCategory(selected, { name: value.name, emoji: value.emoji, color: value.color });
          setSelected(value.name);
          setEditing(false);
        }}
      />
    </ScrollView>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 120, gap: 14 },
    pickerWrap: {},
    pickerRow: { gap: 8, paddingVertical: 2 },
    pickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1
    },
    pickEmoji: { fontSize: 14 },
    pickText: { fontWeight: '700', fontSize: 13, maxWidth: 120 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: 16
    },
    heroIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    heroEmoji: { fontSize: 26 },
    heroInfo: { flex: 1, gap: 2 },
    heroName: { color: c.text, fontSize: 18, fontWeight: '800' },
    heroMeta: { color: c.textMuted, fontSize: 12 },
    heroRight: { alignItems: 'flex-end', gap: 6 },
    heroTotal: { color: c.text, fontSize: 18, fontWeight: '900' },
    editBtn: { backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
    editText: { color: c.accentText, fontWeight: '800', fontSize: 12 },
    empty: { color: c.textMuted, textAlign: 'center', paddingVertical: 40 }
  });
