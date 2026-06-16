import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from './src/components/AppHeader';
import { BottomNav } from './src/components/BottomNav';
import { BrandMark } from './src/components/BrandMark';
import { ImportProgressOverlay } from './src/components/ImportProgressOverlay';
import { ReconnectBanner } from './src/components/ReconnectBanner';
import { ShowcaseBanner } from './src/components/ShowcaseBanner';
import { LedgerProvider, useLedger } from './src/context/LedgerContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { AddTransactionScreen } from './src/screens/AddTransactionScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TransScreen } from './src/screens/TransScreen';

function AppShell() {
  const { palette: c, mode } = useTheme();
  const { mainTab, setMainTab, setShowAdd, cancelEdit, loadPhase, message, refresh } = useLedger();

  if (loadPhase === 'loading') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.center}>
          <BrandMark size={76} />
          <ActivityIndicator color={c.accent} size="large" style={{ marginTop: 18 }} />
          <Text style={[styles.centerText, { color: c.textMuted }]}>Loading your ledger…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadPhase === 'error') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.center}>
          <BrandMark size={76} />
          <Text style={[styles.errorTitle, { color: c.text }]}>Could not load data</Text>
          <Text style={[styles.centerText, { color: c.textMuted }]}>{message}</Text>
          <TouchableOpacity style={[styles.retry, { backgroundColor: c.accent }]} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ReconnectBanner />
      <ShowcaseBanner />
      <AppHeader
        onAdd={() => {
          cancelEdit();
          setShowAdd(true);
        }}
      />

      <View style={styles.body}>
        {mainTab === 'trans' ? <TransScreen /> : null}
        {mainTab === 'stats' ? <StatsScreen /> : null}
        {mainTab === 'categories' ? <CategoriesScreen /> : null}
        {mainTab === 'accounts' ? <AccountsScreen /> : null}
        {mainTab === 'more' ? <MoreScreen /> : null}
      </View>

      <BottomNav active={mainTab} onChange={setMainTab} />
      <AddTransactionScreen />
      <ImportProgressOverlay />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LedgerProvider>
        <AppShell />
      </LedgerProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  centerText: { textAlign: 'center', marginTop: 6 },
  errorTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  retry: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' }
});
