import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import { computeAccountBalances, monthKey } from '../../../shared/finance';
import { formatMoney, monthTitle } from '../../../shared/uiHelpers';
import { useLedger } from '../context/LedgerContext';

const ACCOUNT_ICONS: Record<string, string> = {
  Cash: '💵',
  Bank: '🏦',
  Savings: '🐷'
};

export function AccountsScreen() {
  const { accounts, transactions, carryForward, selectedMonth } = useLedger();
  const month = monthKey(selectedMonth);
  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions, { carryForward, month }),
    [accounts, transactions, carryForward, month]
  );
  const totalAssets = balances.reduce((sum, account) => sum + account.balance, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Accounts</Text>
      <Text style={styles.subtitle}>
        {carryForward ? 'Running balances' : `Balances · ${monthTitle(selectedMonth.getFullYear(), selectedMonth.getMonth())}`}
      </Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{carryForward ? 'Total balance (running)' : 'Total balance this month'}</Text>
        <Text style={styles.totalValue}>{formatMoney(totalAssets)}</Text>
      </View>

      <Text style={styles.groupTitle}>ACCOUNTS</Text>
      {balances.map((account) => (
        <View style={styles.accountRow} key={account.name}>
          <View style={styles.accountLeft}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{ACCOUNT_ICONS[account.name] ?? '📁'}</Text>
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
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 120, gap: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, marginBottom: 6 },
  totalCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 6,
    marginBottom: 8
  },
  totalLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  totalValue: { color: colors.balance, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  groupTitle: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: { fontSize: 20 },
  accountInfo: { flex: 1, gap: 4 },
  accountName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  flowRow: { flexDirection: 'row', gap: 12 },
  flowIncome: { color: colors.income, fontSize: 12, fontWeight: '600' },
  flowExpense: { color: colors.expense, fontSize: 12, fontWeight: '600' },
  accountRight: { alignItems: 'flex-end', gap: 2 },
  accountMeta: { color: colors.textDim, fontSize: 11 },
  accountBalance: { color: colors.text, fontWeight: '800', fontSize: 16 }
});
