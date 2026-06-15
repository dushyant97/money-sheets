import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, radius } from '../../../shared/theme';
import { budgetProgressForMonth, computeAccountBalances, monthKey } from '../../../shared/finance';
import type { TransactionType } from '../../../shared/finance';
import { formatMoney, getCategoryMeta } from '../../../shared/uiHelpers';
import { useLedger } from '../context/LedgerContext';

export function MoreScreen() {
  const {
    transactions,
    accounts,
    budgets,
    categories,
    selectedMonth,
    busy,
    carryForward,
    setCarryForward,
    refresh,
    exportCsv,
    importCsv,
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Budgets &amp; Data</Text>
      <Text style={styles.subtitle}>Offline on this device</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingName}>Monthly carry forward</Text>
            <Text style={styles.cardHint}>
              When on, each month starts from the previous month's running balance. Off by default — every month is
              independent.
            </Text>
          </View>
          <Switch
            value={carryForward}
            onValueChange={(value) => void setCarryForward(value)}
            trackColor={{ false: colors.surfaceHover, true: colors.accent }}
            thumbColor="#fff"
            disabled={busy}
          />
        </View>
      </View>

      <CategoryAccountManager />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backup &amp; restore</Text>
        <Text style={styles.cardHint}>
          Export CSV to Excel or another device. Import replaces all local data after you confirm.
        </Text>
        <MenuButton label="Export CSV" onPress={() => void exportCsv()} />
        <MenuButton label="Import CSV" onPress={() => void importCsv()} />
        <MenuButton label="Erase all data" danger onPress={() => void resetAllData()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly budgets</Text>
        <Text style={styles.cardHint}>Month: {month}</Text>
        <TextInput
          style={styles.input}
          value={budgetCategory}
          onChangeText={setBudgetCategory}
          placeholder="Category"
          placeholderTextColor={colors.textDim}
        />
        <TextInput
          style={styles.input}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          placeholder="Budget amount"
          placeholderTextColor={colors.textDim}
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
            <Text style={styles.budgetName}>{getCategoryMeta(row.category).emoji} {row.category}</Text>
            <Text style={styles.budgetMeta}>
              {formatMoney(row.spent)} / {formatMoney(row.budget)}
            </Text>
          </View>
        ))}
      </View>

      <MenuButton label="Refresh from storage" onPress={() => void refresh()} />
    </ScrollView>
  );
}

function CategoryAccountManager() {
  const { categories, accounts, transactions, selectedMonth, carryForward, addCategory, deleteCategory, addAccount, deleteAccount } =
    useLedger();
  const [tab, setTab] = useState<'categories' | 'accounts'>('categories');

  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');

  const [acctName, setAcctName] = useState('');
  const [acctCurrency, setAcctCurrency] = useState('INR');
  const [acctOpening, setAcctOpening] = useState('');

  const month = monthKey(selectedMonth);
  const balances = computeAccountBalances(accounts, transactions, { carryForward, month });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Manage categories &amp; accounts</Text>
      <View style={styles.segment}>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'categories' && styles.segmentBtnActive]}
          onPress={() => setTab('categories')}
        >
          <Text style={[styles.segmentText, tab === 'categories' && styles.segmentTextActive]}>Categories</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'accounts' && styles.segmentBtnActive]}
          onPress={() => setTab('accounts')}
        >
          <Text style={[styles.segmentText, tab === 'accounts' && styles.segmentTextActive]}>Accounts</Text>
        </TouchableOpacity>
      </View>

      {tab === 'categories' ? (
        <>
          <TextInput
            style={styles.input}
            value={catName}
            onChangeText={setCatName}
            placeholder="New category name"
            placeholderTextColor={colors.textDim}
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

          <View style={styles.tagWrap}>
            {categories.map((category) => (
              <View key={category.name} style={styles.tag}>
                <Text style={styles.tagText}>{getCategoryMeta(category.name).emoji} {category.name}</Text>
                <TouchableOpacity onPress={() => void deleteCategory(category.name)} hitSlop={8}>
                  <Text style={styles.tagRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={acctName}
            onChangeText={setAcctName}
            placeholder="New account name"
            placeholderTextColor={colors.textDim}
          />
          <View style={styles.typeRow}>
            <TextInput
              style={[styles.input, styles.flex1]}
              value={acctCurrency}
              onChangeText={setAcctCurrency}
              placeholder="Currency (INR)"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />
            <TextInput
              style={[styles.input, styles.flex1]}
              value={acctOpening}
              onChangeText={setAcctOpening}
              placeholder="Opening balance"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, !acctName.trim() && styles.buttonDisabled]}
            disabled={!acctName.trim()}
            onPress={() => {
              void addAccount(acctName, acctCurrency, acctOpening);
              setAcctName('');
              setAcctOpening('');
            }}
          >
            <Text style={styles.buttonText}>Add account</Text>
          </TouchableOpacity>

          {accounts.map((account) => {
            const balance = balances.find((b) => b.name === account.name)?.balance ?? account.openingBalance;
            return (
              <View key={account.name} style={styles.acctRow}>
                <View style={styles.acctBadge}>
                  <Text style={styles.acctBadgeText}>{account.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.acctName}>{account.name}</Text>
                  <Text style={styles.cardHint}>
                    {account.currency} · opening {formatMoney(account.openingBalance, account.currency)}
                  </Text>
                </View>
                <Text style={styles.acctBalance}>{formatMoney(balance, account.currency)}</Text>
                <TouchableOpacity onPress={() => void deleteAccount(account.name)} hitSlop={8}>
                  <Text style={styles.tagRemove}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function MenuButton({
  label,
  onPress,
  danger
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuBtn} onPress={onPress}>
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 120, gap: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginBottom: 8
  },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  cardHint: { color: colors.textMuted, fontSize: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1, gap: 2 },
  settingName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  flex1: { flex: 1 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '800' },
  segment: { flexDirection: 'row', gap: 6 },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  segmentBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: colors.accentText },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  typeBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  typeText: { color: colors.textMuted, fontWeight: '800' },
  typeTextActive: { color: colors.accentText },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border
  },
  tagText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  tagRemove: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: 12
  },
  acctBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  acctBadgeText: { color: colors.accentText, fontWeight: '800' },
  acctName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  acctBalance: { color: colors.text, fontWeight: '800', fontSize: 14 },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  budgetOver: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, paddingHorizontal: 8 },
  budgetName: { color: colors.text, fontWeight: '700' },
  budgetMeta: { color: colors.textMuted, fontSize: 12 },
  menuBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16
  },
  menuText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  menuDanger: { color: colors.danger },
  menuChevron: { color: colors.textDim, fontSize: 22 }
});
