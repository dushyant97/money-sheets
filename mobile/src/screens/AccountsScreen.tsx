import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import type { AccountBalance } from '../../../shared/finance';
import { computeAccountBalances, monthKey } from '../../../shared/finance';
import { formatMoney, getAccountMeta, monthTitle } from '../../../shared/uiHelpers';
import { EntityEditorModal } from '../components/EntityEditorModal';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

export function AccountsScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { accounts, transactions, carryForward, selectedMonth, updateAccount } = useLedger();
  const [editing, setEditing] = useState<string | null>(null);

  const month = monthKey(selectedMonth);
  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions, { carryForward, month }),
    [accounts, transactions, carryForward, month]
  );
  const totalAssets = balances.reduce((sum, account) => sum + account.balance, 0);
  const editingAccount = accounts.find((account) => account.name === editing);
  const editingMeta = editing ? getAccountMeta(editing) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        {carryForward
          ? 'Running balances'
          : `Balances · ${monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}`}
      </Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{carryForward ? 'Total balance (running)' : 'Total balance this month'}</Text>
        <Text style={styles.totalValue}>{formatMoney(totalAssets)}</Text>
      </View>

      {balances.map((account) => (
        <AccountCard key={account.name} account={account} c={c} styles={styles} onEdit={() => setEditing(account.name)} />
      ))}

      <EntityEditorModal
        visible={editing !== null}
        title={`Edit ${editing ?? ''}`}
        showAccountFields
        initial={{
          name: editing ?? '',
          emoji: editingMeta?.emoji ?? '',
          color: editingMeta?.color ?? c.accent,
          currency: editingAccount?.currency ?? 'INR',
          openingBalance: editingAccount ? String(editingAccount.openingBalance) : '0'
        }}
        onClose={() => setEditing(null)}
        onSave={(value) => {
          if (!editing) return;
          void updateAccount(editing, {
            name: value.name,
            emoji: value.emoji,
            color: value.color,
            currency: value.currency,
            openingBalance: Number(value.openingBalance) || 0
          });
          setEditing(null);
        }}
      />
    </ScrollView>
  );
}

function AccountCard({
  account,
  c,
  styles,
  onEdit
}: {
  account: AccountBalance;
  c: ThemePalette;
  styles: ReturnType<typeof makeStyles>;
  onEdit: () => void;
}) {
  const meta = getAccountMeta(account.name);
  return (
    <TouchableOpacity style={styles.accountRow} onPress={onEdit} activeOpacity={0.8}>
      <View style={styles.accountLeft}>
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
          <Text style={styles.icon}>{meta.emoji || account.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{account.name}</Text>
          <View style={styles.flowRow}>
            <Text style={styles.flowIncome}>+{formatMoney(account.income, account.currency)}</Text>
            <Text style={styles.flowExpense}>-{formatMoney(account.expense, account.currency)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.accountRight}>
        <Text style={styles.accountBalance}>{formatMoney(account.balance, account.currency)}</Text>
        <Text style={styles.accountMeta}>opening {formatMoney(account.openingBalance, account.currency)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 120, gap: 10 },
    subtitle: { color: c.textMuted, marginBottom: 2 },
    totalCard: {
      backgroundColor: c.surface2,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 6,
      marginBottom: 8
    },
    totalLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    totalValue: { color: c.balance, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 8
    },
    accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 20, color: c.text, fontWeight: '800' },
    accountInfo: { flex: 1, gap: 4 },
    accountName: { color: c.text, fontWeight: '700', fontSize: 15 },
    flowRow: { flexDirection: 'row', gap: 12 },
    flowIncome: { color: c.income, fontSize: 12, fontWeight: '600' },
    flowExpense: { color: c.expense, fontSize: 12, fontWeight: '600' },
    accountRight: { alignItems: 'flex-end', gap: 2 },
    accountMeta: { color: c.textDim, fontSize: 11 },
    accountBalance: { color: c.text, fontWeight: '800', fontSize: 16 }
  });
