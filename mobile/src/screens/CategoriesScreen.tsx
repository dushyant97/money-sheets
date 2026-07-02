import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { filterTransactions, monthKey, transactionsInMonth } from '../../../shared/finance';
import { formatMoney, getCategoryMeta } from '../../../shared/uiHelpers';
import { CategoryFilterSheet, ALL_CATEGORIES, type CategoryOption } from '../components/CategoryFilterSheet';
import { EntityEditorModal } from '../components/EntityEditorModal';
import { TransactionGroups } from '../components/TransactionGroups';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

const SCROLL_TOP_THRESHOLD = 320;

export function CategoriesScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { categories, transactions, selectedMonth, updateCategory, startEdit, deleteTransaction } = useLedger();

  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const month = monthKey(selectedMonth);
  const monthTransactions = useMemo(() => transactionsInMonth(transactions, month), [transactions, month]);

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);

  useEffect(() => {
    if (selected !== ALL_CATEGORIES && !activeCategories.some((category) => category.name === selected)) {
      setSelected(ALL_CATEGORIES);
    }
  }, [activeCategories, selected]);

  const categoryOptions = useMemo<CategoryOption[]>(
    () =>
      activeCategories.map((category) => ({
        name: category.name,
        count: monthTransactions.filter((t) => t.category === category.name).length
      })),
    [activeCategories, monthTransactions]
  );

  const rows = useMemo(
    () =>
      filterTransactions(monthTransactions, {
        category: selected === ALL_CATEGORIES ? undefined : selected,
        search: search.trim() || undefined
      }),
    [monthTransactions, selected, search]
  );

  const income = rows.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  const selectedLabel = selected === ALL_CATEGORIES ? 'All Categories' : selected;
  const selectedMeta = selected === ALL_CATEGORIES ? null : getCategoryMeta(selected);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setShowScrollTop(event.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.summary, { backgroundColor: c.surface }]}>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: c.textDim }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: c.income }]} numberOfLines={1}>
              {formatMoney(income)}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: c.borderSoft }]} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: c.textDim }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: c.expense }]} numberOfLines={1}>
              {formatMoney(expense)}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: c.borderSoft }]} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: c.textDim }]}>Net</Text>
            <Text style={[styles.summaryValue, { color: net >= 0 ? c.income : c.expense }]} numberOfLines={1}>
              {net < 0 ? '-' : ''}
              {formatMoney(Math.abs(net))}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.dropdown, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => setSheetOpen(true)}
          >
            <Text style={styles.dropdownEmoji}>{selectedMeta?.emoji ?? '📁'}</Text>
            <Text style={[styles.dropdownText, { color: c.text }]} numberOfLines={1}>
              {selectedLabel}
            </Text>
            <Text style={[styles.dropdownCaret, { color: c.textMuted }]}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.searchBtn, { backgroundColor: searchOpen ? c.accentSoft : c.surface, borderColor: searchOpen ? c.accent : c.border }]}
            onPress={() => {
              setSearchOpen((open) => {
                if (open) setSearch('');
                return !open;
              });
            }}
            accessibilityLabel="Search transactions"
          >
            <Text style={styles.searchBtnIcon}>🔍</Text>
          </TouchableOpacity>
        </View>

        {searchOpen ? (
          <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: c.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes, account, amount…"
              placeholderTextColor={c.textDim}
              autoCapitalize="none"
              autoFocus
            />
            {search ? (
              <TouchableOpacity hitSlop={8} onPress={() => setSearch('')}>
                <Text style={[styles.searchClear, { color: c.textDim }]}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {selectedMeta ? (
          <View style={styles.selectedHead}>
            <Text style={[styles.selectedCount, { color: c.textMuted }]}>
              {rows.length} transaction{rows.length === 1 ? '' : 's'} · {selectedLabel}
            </Text>
            <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
              <Text style={[styles.editLink, { color: c.accentText }]}>Edit category</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TransactionGroups
          transactions={rows}
          onEdit={startEdit}
          onDelete={(t) => void deleteTransaction(t)}
        />
      </ScrollView>

      {showScrollTop ? (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.scrollTop, { backgroundColor: c.accent }]}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          accessibilityLabel="Scroll to top"
        >
          <Text style={styles.scrollTopIcon}>↑</Text>
        </TouchableOpacity>
      ) : null}

      <CategoryFilterSheet
        visible={sheetOpen}
        categories={categoryOptions}
        selected={selected}
        onSelect={setSelected}
        onClose={() => setSheetOpen(false)}
      />

      {selectedMeta ? (
        <EntityEditorModal
          visible={editing}
          title={`Edit ${selected}`}
          initial={{ name: selected, emoji: selectedMeta.emoji, color: selectedMeta.color }}
          onClose={() => setEditing(false)}
          onSave={(value) => {
            void updateCategory(selected, { name: value.name, emoji: value.emoji, color: value.color });
            setSelected(value.name);
            setEditing(false);
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 130, gap: 14 },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 22,
      paddingVertical: 20,
      paddingHorizontal: 12
    },
    summaryCol: { flex: 1, alignItems: 'center', gap: 6 },
    summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
    summaryLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    summaryValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dropdown: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 48,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: 16
    },
    dropdownEmoji: { fontSize: 16 },
    dropdownText: { flex: 1, fontSize: 15, fontWeight: '700' },
    dropdownCaret: { fontSize: 14 },
    searchBtn: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center'
    },
    searchBtnIcon: { fontSize: 16 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: 16,
      height: 46
    },
    searchIcon: { fontSize: 14 },
    searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
    searchClear: { fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
    selectedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    selectedCount: { fontSize: 13, fontWeight: '600' },
    editLink: { fontSize: 13, fontWeight: '800' },
    scrollTop: {
      position: 'absolute',
      right: 20,
      bottom: 28,
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6
    },
    scrollTopIcon: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: -2 }
  });
