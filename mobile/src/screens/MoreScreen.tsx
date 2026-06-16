import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import type { TransactionType } from '../../../shared/finance';
import { budgetProgressForMonth, monthKey } from '../../../shared/finance';
import { formatMoney, getAccountMeta, getCategoryMeta } from '../../../shared/uiHelpers';
import { EntityEditorModal, type EntityEditorValue } from '../components/EntityEditorModal';
import { StorageSettingsPanel } from '../components/StorageSettingsPanel';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

export function MoreScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const {
    transactions,
    budgets,
    categories,
    selectedMonth,
    busy,
    carryForward,
    showcaseMode,
    setCarryForward,
    enableShowcaseMode,
    exitShowcaseMode,
    refresh,
    exportCsv,
    exportExcel,
    importFile,
    resetAllData,
    saveBudget
  } = useLedger();

  const month = monthKey(selectedMonth);
  const budgetProgress = useMemo(
    () => budgetProgressForMonth(budgets, transactions, month),
    [budgets, transactions, month]
  );
  const expenseCategories = categories.filter((category) => category.active && category.type === 'expense');

  const [budgetCategory, setBudgetCategory] = useState(expenseCategories[0]?.name ?? 'Food');
  const [budgetAmount, setBudgetAmount] = useState('');

  function confirmShowcase() {
    Alert.alert(
      'Enable showcase mode?',
      'All data currently set will be permanently lost. Export a backup first if you need to keep your real records.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => void enableShowcaseMode() }
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StorageSettingsPanel />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingName}>Monthly carry forward</Text>
            <Text style={styles.cardHint}>
              When on, each month starts from the previous month's running balance. Off by default.
            </Text>
          </View>
          <Switch
            value={carryForward}
            onValueChange={(value) => void setCarryForward(value)}
            trackColor={{ false: c.surfaceHover, true: c.accent }}
            thumbColor="#fff"
            disabled={busy}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingName}>Showcase mode</Text>
            <Text style={styles.cardHint}>Load demo data to explore the app. Replaces your current data.</Text>
          </View>
          {showcaseMode ? (
            <TouchableOpacity style={styles.smallBtn} onPress={() => void exitShowcaseMode()}>
              <Text style={styles.smallBtnText}>Exit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.smallBtn} onPress={confirmShowcase}>
              <Text style={styles.smallBtnText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ManagePanel />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly budgets</Text>
        <Text style={styles.cardHint}>Month: {month}</Text>
        <TextInput
          style={styles.input}
          value={budgetCategory}
          onChangeText={setBudgetCategory}
          placeholder="Category"
          placeholderTextColor={c.textDim}
        />
        <TextInput
          style={styles.input}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          placeholder="Budget amount"
          placeholderTextColor={c.textDim}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[styles.button, (!budgetAmount.trim() || busy) && styles.buttonDisabled]}
          disabled={!budgetAmount.trim() || busy}
          onPress={() => {
            void saveBudget(budgetCategory, budgetAmount, 'INR');
            setBudgetAmount('');
          }}
        >
          <Text style={styles.buttonText}>Save budget</Text>
        </TouchableOpacity>

        {budgetProgress.map((row) => (
          <View style={[styles.budgetRow, row.overBudget && styles.budgetOver]} key={row.category}>
            <Text style={styles.budgetName}>
              {getCategoryMeta(row.category).emoji} {row.category}
            </Text>
            <Text style={styles.budgetMeta}>
              {formatMoney(row.spent)} / {formatMoney(row.budget)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backup &amp; restore</Text>
        <Text style={styles.cardHint}>
          Export to CSV or Excel for a backup. Import replaces all local data after you confirm.
        </Text>
        <MenuButton label="Export CSV" onPress={() => void exportCsv()} />
        <MenuButton label="Export Excel (.xlsx)" onPress={() => void exportExcel()} />
        <MenuButton label="Import CSV or Excel" onPress={() => void importFile()} />
        <MenuButton label="Refresh from storage" onPress={() => void refresh()} />
        <MenuButton label="Erase all data" danger onPress={() => void resetAllData()} />
      </View>
    </ScrollView>
  );
}

function ManagePanel() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const {
    categories,
    accounts,
    addCategory,
    updateCategory,
    deleteCategory,
    addAccount,
    updateAccount,
    deleteAccount
  } = useLedger();

  const [tab, setTab] = useState<'categories' | 'accounts'>('categories');
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [acctName, setAcctName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingAcct, setEditingAcct] = useState<string | null>(null);

  const editingCatMeta = editingCat ? getCategoryMeta(editingCat) : null;
  const editingAcct2 = accounts.find((account) => account.name === editingAcct);
  const editingAcctMeta = editingAcct ? getAccountMeta(editingAcct) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Manage categories &amp; accounts</Text>
      <View style={styles.segment}>
        {(['categories', 'accounts'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.segmentBtn, tab === value && styles.segmentBtnActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.segmentText, tab === value && styles.segmentTextActive]}>
              {value === 'categories' ? 'Categories' : 'Accounts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'categories' ? (
        <>
          <TextInput
            style={styles.input}
            value={catName}
            onChangeText={setCatName}
            placeholder="New category name"
            placeholderTextColor={c.textDim}
          />
          <View style={styles.typeRow}>
            {(['expense', 'income'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, catType === type && styles.typeBtnActive]}
                onPress={() => setCatType(type)}
              >
                <Text style={[styles.typeText, catType === type && styles.typeTextActive]}>
                  {type === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, !catName.trim() && styles.buttonDisabled]}
            disabled={!catName.trim()}
            onPress={() => {
              void addCategory(catName, catType);
              setCatName('');
            }}
          >
            <Text style={styles.buttonText}>Add category</Text>
          </TouchableOpacity>

          {categories.map((category) => {
            const meta = getCategoryMeta(category.name);
            return (
              <View key={category.name} style={styles.manageRow}>
                <View style={[styles.manageBadge, { backgroundColor: `${meta.color}22` }]}>
                  <Text style={styles.manageBadgeText}>{meta.emoji}</Text>
                </View>
                <Text style={styles.manageName}>{category.name}</Text>
                <Text style={styles.manageTag}>{category.type}</Text>
                <TouchableOpacity onPress={() => setEditingCat(category.name)} hitSlop={8}>
                  <Text style={styles.manageAction}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void deleteCategory(category.name)} hitSlop={8}>
                  <Text style={styles.manageAction}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={acctName}
            onChangeText={setAcctName}
            placeholder="New account name"
            placeholderTextColor={c.textDim}
          />
          <TouchableOpacity
            style={[styles.button, !acctName.trim() && styles.buttonDisabled]}
            disabled={!acctName.trim()}
            onPress={() => {
              void addAccount(acctName, 'INR', '0');
              setAcctName('');
            }}
          >
            <Text style={styles.buttonText}>Add account</Text>
          </TouchableOpacity>

          {accounts.map((account) => {
            const meta = getAccountMeta(account.name);
            return (
              <View key={account.name} style={styles.manageRow}>
                <View style={[styles.manageBadge, { backgroundColor: `${meta.color}22` }]}>
                  <Text style={styles.manageBadgeText}>{meta.emoji || account.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.manageName}>{account.name}</Text>
                <Text style={styles.manageTag}>{account.currency}</Text>
                <TouchableOpacity onPress={() => setEditingAcct(account.name)} hitSlop={8}>
                  <Text style={styles.manageAction}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void deleteAccount(account.name)} hitSlop={8}>
                  <Text style={styles.manageAction}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      <EntityEditorModal
        visible={editingCat !== null}
        title={`Edit ${editingCat ?? ''}`}
        initial={{ name: editingCat ?? '', emoji: editingCatMeta?.emoji ?? '', color: editingCatMeta?.color ?? c.accent }}
        onClose={() => setEditingCat(null)}
        onSave={(value: EntityEditorValue) => {
          if (editingCat) void updateCategory(editingCat, { name: value.name, emoji: value.emoji, color: value.color });
          setEditingCat(null);
        }}
      />
      <EntityEditorModal
        visible={editingAcct !== null}
        title={`Edit ${editingAcct ?? ''}`}
        showAccountFields
        initial={{
          name: editingAcct ?? '',
          emoji: editingAcctMeta?.emoji ?? '',
          color: editingAcctMeta?.color ?? c.accent,
          currency: editingAcct2?.currency ?? 'INR',
          openingBalance: editingAcct2 ? String(editingAcct2.openingBalance) : '0'
        }}
        onClose={() => setEditingAcct(null)}
        onSave={(value: EntityEditorValue) => {
          if (editingAcct)
            void updateAccount(editingAcct, {
              name: value.name,
              emoji: value.emoji,
              color: value.color,
              currency: value.currency,
              openingBalance: Number(value.openingBalance) || 0
            });
          setEditingAcct(null);
        }}
      />
    </View>
  );
}

function MenuButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <TouchableOpacity style={styles.menuBtn} onPress={onPress}>
      <Text style={[styles.menuText, danger && { color: c.danger }]}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 120, gap: 10 },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 10,
      marginBottom: 8
    },
    cardTitle: { color: c.text, fontWeight: '800', fontSize: 16 },
    cardHint: { color: c.textMuted, fontSize: 12 },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    settingText: { flex: 1, gap: 2 },
    settingName: { color: c.text, fontWeight: '700', fontSize: 14 },
    smallBtn: { backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
    smallBtnText: { color: c.accentText, fontWeight: '800', fontSize: 12 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 12
    },
    button: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: '#fff', fontWeight: '800' },
    segment: { flexDirection: 'row', gap: 6 },
    segmentBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: 'transparent'
    },
    segmentBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    segmentText: { color: c.textMuted, fontWeight: '700', fontSize: 12 },
    segmentTextActive: { color: c.accentText },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radius.md,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center'
    },
    typeBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    typeText: { color: c.textMuted, fontWeight: '800' },
    typeTextActive: { color: c.accentText },
    manageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgElevated,
      borderRadius: radius.md,
      padding: 10
    },
    manageBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    manageBadgeText: { fontSize: 16, color: c.text, fontWeight: '800' },
    manageName: { flex: 1, color: c.text, fontWeight: '700', fontSize: 14 },
    manageTag: { color: c.textDim, fontSize: 11, textTransform: 'capitalize' },
    manageAction: { fontSize: 15, paddingHorizontal: 2 },
    budgetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border
    },
    budgetOver: { backgroundColor: c.dangerSoft, borderRadius: radius.sm, paddingHorizontal: 8 },
    budgetName: { color: c.text, fontWeight: '700' },
    budgetMeta: { color: c.textMuted, fontSize: 12 },
    menuBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 14
    },
    menuText: { color: c.text, fontWeight: '600', fontSize: 15 },
    menuChevron: { color: c.textDim, fontSize: 22 }
  });
