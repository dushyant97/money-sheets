import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { TAB_TITLES } from '../../../shared/nav';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';
import { MonthNav } from './MonthNav';
import { ThemeToggle } from './ThemeToggle';

/** Status line describing the active storage mode, mirroring the web pill. */
function storageStatus(effectiveMode: string, isTursoFallback: boolean): string {
  if (effectiveMode === 'turso') return 'Synced with Turso';
  if (isTursoFallback) return 'Offline · local copy';
  return 'On this device';
}

export function AppHeader({ onAdd }: { onAdd: () => void }) {
  const { palette: c } = useTheme();
  const { mainTab, selectedMonth, setSelectedMonth, message, effectiveStorage } = useLedger();

  function shiftMonth(delta: number) {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + delta, 1));
  }

  const status = message || storageStatus(effectiveStorage.effectiveMode, effectiveStorage.isTursoFallback);

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderBottomColor: c.borderSoft }]}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {TAB_TITLES[mainTab]}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => Alert.alert('Status', status)}
            onPress={() => Alert.alert('Status', status)}
          >
            <Text style={[styles.status, { color: c.textMuted }]} numberOfLines={2}>
              {status}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actions}>
          <ThemeToggle />
          <TouchableOpacity
            style={[styles.add, { backgroundColor: c.accent }]}
            onPress={onAdd}
            activeOpacity={0.85}
            accessibilityLabel="Add transaction"
          >
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <MonthNav month={selectedMonth} onShift={shiftMonth} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 10, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1, gap: 2 },
  title: { fontSize: 22, fontWeight: '800' },
  status: { fontSize: 11, lineHeight: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  add: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addText: { color: '#fff', fontSize: 26, lineHeight: 28, fontWeight: '300', marginTop: -2 }
});
