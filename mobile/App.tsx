import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../shared/theme';
import { BottomNav } from './src/components/BottomNav';
import { LedgerProvider, useLedger } from './src/context/LedgerContext';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { AddTransactionScreen } from './src/screens/AddTransactionScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TransScreen } from './src/screens/TransScreen';

function AppShell() {
  const { busy, message, mainTab, setMainTab, setShowAdd, cancelEdit, loadPhase } = useLedger();

  if (loadPhase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading your ledger…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadPhase === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <Text style={styles.errorTitle}>Could not load data</Text>
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {busy ? (
        <View style={styles.busyBar}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.busyText}>Working…</Text>
        </View>
      ) : message ? (
        <Text style={styles.toast} numberOfLines={2}>
          {message}
        </Text>
      ) : null}

      <View style={styles.body}>
        {mainTab === 'trans' ? <TransScreen /> : null}
        {mainTab === 'stats' ? <StatsScreen /> : null}
        {mainTab === 'accounts' ? <AccountsScreen /> : null}
        {mainTab === 'more' ? <MoreScreen /> : null}
      </View>

      <BottomNav
        active={mainTab}
        onChange={setMainTab}
        onAdd={() => {
          cancelEdit();
          setShowAdd(true);
        }}
      />
      <AddTransactionScreen />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <LedgerProvider>
      <AppShell />
    </LedgerProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: colors.textMuted, textAlign: 'center' },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  busyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: colors.bgElevated
  },
  busyText: { color: colors.textMuted, fontSize: 12 },
  toast: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: colors.bgElevated
  }
});
