import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { radius } from '../../../shared/theme';
import { useTheme } from '../theme/ThemeProvider';

/** Compact pill that flips between light and dark themes. */
export function ThemeToggle() {
  const { mode, toggle, palette: c } = useTheme();
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      accessibilityLabel={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={[styles.btn, { backgroundColor: c.surface2, borderColor: c.border }]}
    >
      <Text style={styles.icon}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: { fontSize: 16 }
});
