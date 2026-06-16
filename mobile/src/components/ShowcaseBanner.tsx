import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

/** Persistent reminder that the app is showing demo data, with a quick exit. */
export function ShowcaseBanner() {
  const { showcaseMode, exitShowcaseMode, busy } = useLedger();
  const { palette: c } = useTheme();
  if (!showcaseMode) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.warn }]}>
      <Text style={styles.text}>Showcase mode — demo data</Text>
      <TouchableOpacity
        style={styles.btn}
        disabled={busy}
        onPress={() => void exitShowcaseMode()}
        hitSlop={8}
      >
        <Text style={styles.btnText}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 14
  },
  text: { color: '#1a1206', fontWeight: '800', fontSize: 12 },
  btn: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 3 },
  btnText: { color: '#1a1206', fontWeight: '800', fontSize: 12 }
});
