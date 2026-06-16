import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

/**
 * Shown after reconnecting to the network when the local cache and the Turso
 * copy diverged while offline. Lets the user push local changes up or pull the
 * cloud copy down.
 */
export function ReconnectBanner() {
  const { reconnect, syncLocalToTurso, pullFromTurso, dismissReconnect, busy } = useLedger();
  const { palette: c } = useTheme();
  if (!reconnect) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.accentSoft, borderBottomColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>
        Your offline changes differ from Turso. Choose which copy to keep.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.accent }]}
          disabled={busy}
          onPress={() => void syncLocalToTurso()}
        >
          <Text style={styles.btnPrimary}>Push local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]}
          disabled={busy}
          onPress={() => void pullFromTurso()}
        >
          <Text style={[styles.btnText, { color: c.text }]}>Use cloud</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismiss} disabled={busy} onPress={dismissReconnect} hitSlop={8}>
          <Text style={[styles.btnText, { color: c.textMuted }]}>Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: 1 },
  text: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  btnPrimary: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnText: { fontWeight: '700', fontSize: 12 },
  dismiss: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 7 }
});
