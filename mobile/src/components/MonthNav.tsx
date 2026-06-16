import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { monthTitle } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

/** Global month toggle: ‹ June 2026 › shared across screens via context. */
export function MonthNav({
  month,
  onShift
}: {
  month: Date;
  onShift: (delta: number) => void;
}) {
  const { palette: c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface2, borderColor: c.border }]}>
      <TouchableOpacity onPress={() => onShift(-1)} hitSlop={10} style={styles.arrowBtn}>
        <Text style={[styles.arrow, { color: c.text }]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.label, { color: c.text }]}>{monthTitle(month.getFullYear(), month.getMonth())}</Text>
      <TouchableOpacity onPress={() => onShift(1)} hitSlop={10} style={styles.arrowBtn}>
        <Text style={[styles.arrow, { color: c.text }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  arrowBtn: { paddingHorizontal: 12, paddingVertical: 2 },
  arrow: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  label: { fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'center' }
});
