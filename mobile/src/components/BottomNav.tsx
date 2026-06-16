import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { NAV } from '../../../shared/nav';
import type { MainTab } from '../context/LedgerContext';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Five-tab bar mirroring the web mobile layout: each active tab lights its icon
 * in a tinted pill using the per-tab accent from the shared NAV config.
 */
export function BottomNav({
  active,
  onChange
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const { palette: c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bgElevated, borderTopColor: c.borderSoft }]}>
      {NAV.map((item) => {
        const isActive = active === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.tab}
            onPress={() => onChange(item.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View
              style={[
                styles.iconPill,
                isActive && { backgroundColor: `${item.tint}26` }
              ]}
            >
              <Text style={[styles.icon, { opacity: isActive ? 1 : 0.6 }]}>{item.icon}</Text>
            </View>
            <Text
              style={[styles.label, { color: isActive ? item.tint : c.tabInactive }]}
              numberOfLines={1}
            >
              {item.shortLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 4
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconPill: {
    width: 46,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: { fontSize: 17 },
  label: { fontSize: 10, fontWeight: '700' }
});
