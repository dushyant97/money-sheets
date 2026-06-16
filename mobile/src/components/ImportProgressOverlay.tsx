import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

/** Full-screen overlay with a determinate percentage bar during file import. */
export function ImportProgressOverlay() {
  const { importProgress } = useLedger();
  const { palette: c } = useTheme();
  const visible = importProgress !== null;
  const pct = Math.round((importProgress ?? 0) * 100);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>Importing…</Text>
          <View style={[styles.track, { backgroundColor: c.surface2 }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.accent }]} />
          </View>
          <Text style={[styles.pct, { color: c.textMuted }]}>{pct}%</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { width: '100%', maxWidth: 320, borderRadius: radius.lg, borderWidth: 1, padding: 22, gap: 12 },
  title: { fontSize: 16, fontWeight: '800' },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  pct: { fontSize: 13, fontWeight: '700', textAlign: 'right' }
});
