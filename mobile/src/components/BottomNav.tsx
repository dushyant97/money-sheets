import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import type { MainTab } from '../context/LedgerContext';

const TABS: Array<{ id: MainTab; label: string; icon: string }> = [
  { id: 'trans', label: 'Trans.', icon: '📒' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'accounts', label: 'Accounts', icon: '🏦' },
  { id: 'more', label: 'More', icon: '⚙️' }
];

export function BottomNav({
  active,
  onChange,
  onAdd
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {TABS.slice(0, 2).map((tab) => (
          <TabButton key={tab.id} tab={tab} active={active === tab.id} onPress={() => onChange(tab.id)} />
        ))}
        <View style={styles.fabSlot}>
          <TouchableOpacity style={styles.fab} onPress={onAdd} activeOpacity={0.85}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
        {TABS.slice(2).map((tab) => (
          <TabButton key={tab.id} tab={tab} active={active === tab.id} onPress={() => onChange(tab.id)} />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  active,
  onPress
}: {
  tab: { id: MainTab; label: string; icon: string };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgElevated
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingBottom: 2
  },
  tabIcon: {
    fontSize: 18,
    color: colors.tabInactive
  },
  tabIconActive: {
    color: colors.tabActive
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.tabInactive
  },
  tabLabelActive: {
    color: colors.tabActive
  },
  fabSlot: {
    width: 72,
    alignItems: 'center',
    marginTop: -28
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
    marginTop: -2
  }
});
