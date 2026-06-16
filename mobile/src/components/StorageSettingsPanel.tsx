import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { isTursoConfigComplete, isValidTursoUrl } from '../../../shared/storage/prefs';
import type { StorageMode } from '../../../shared/storage/types';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

/** Confirm overwrite via a native alert, resolving the switch flow's promise. */
function confirmReplaceAlert(targetMode: StorageMode): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Replace existing data?',
      `The ${targetMode === 'turso' ? 'Turso' : 'local'} store already has data. Switching will overwrite it with the data currently in use. Continue?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Replace', style: 'destructive', onPress: () => resolve(true) }
      ],
      { onDismiss: () => resolve(false), cancelable: true }
    );
  });
}

export function StorageSettingsPanel() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { storagePrefs, effectiveStorage, busy, testTursoConnection, applyStorageSettings } = useLedger();

  const [mode, setMode] = useState<StorageMode>(storagePrefs.mode);
  const [url, setUrl] = useState(storagePrefs.turso.url);
  const [authToken, setAuthToken] = useState(storagePrefs.turso.authToken);
  const [showToken, setShowToken] = useState(false);
  const [testState, setTestState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({
    kind: 'idle'
  });

  const offline = !effectiveStorage.isOnline;
  const tursoComplete = isTursoConfigComplete({ url, authToken });

  const activeLabel =
    effectiveStorage.effectiveMode === 'turso'
      ? 'Active: Turso (cloud sync)'
      : effectiveStorage.isTursoFallback
        ? 'Active: Local (Turso offline)'
        : 'Active: Local (this device)';

  async function handleTest() {
    setTestState({ kind: 'testing' });
    try {
      await testTursoConnection({ url, authToken });
      setTestState({ kind: 'ok', message: 'Connection works.' });
    } catch (error) {
      setTestState({ kind: 'error', message: error instanceof Error ? error.message : 'Connection failed.' });
    }
  }

  async function handleSave() {
    const next = { mode, turso: { url: url.trim(), authToken: authToken.trim() } };
    if (next.mode === 'turso' && !tursoComplete) {
      Alert.alert('Incomplete Turso config', 'Enter a valid Turso URL and auth token first.');
      return;
    }
    await applyStorageSettings(next, confirmReplaceAlert);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Storage</Text>
      <View style={[styles.activeCard, { borderLeftColor: effectiveStorage.effectiveMode === 'turso' ? c.income : c.balance }]}>
        <Text style={styles.activeText}>{activeLabel}</Text>
        <Text style={styles.activeHint}>
          {effectiveStorage.effectiveMode === 'turso'
            ? 'Changes sync to your Turso database and this device.'
            : 'Changes are saved on this device. Export to back up.'}
        </Text>
      </View>

      <View style={styles.modeGrid}>
        <TouchableOpacity
          style={[styles.modeCard, mode === 'local' && styles.modeCardActive]}
          onPress={() => setMode('local')}
        >
          <Text style={styles.modeTitle}>📱 Local</Text>
          <Text style={styles.modeDesc}>Offline-first on this device.</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeCard, mode === 'turso' && styles.modeCardActive, offline && styles.modeCardDisabled]}
          disabled={offline}
          onPress={() => setMode('turso')}
        >
          <Text style={styles.modeTitle}>☁️ Turso</Text>
          <Text style={styles.modeDesc}>{offline ? 'Unavailable offline' : 'Sync across devices.'}</Text>
        </TouchableOpacity>
      </View>

      {mode === 'turso' ? (
        <View style={styles.config}>
          <Text style={styles.label}>Database URL</Text>
          <TextInput
            style={[styles.field, url && !isValidTursoUrl(url) && { borderColor: c.danger }]}
            value={url}
            onChangeText={setUrl}
            placeholder="libsql://your-db.turso.io"
            placeholderTextColor={c.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>Auth token</Text>
          <View style={styles.tokenRow}>
            <TextInput
              style={[styles.field, { flex: 1 }]}
              value={authToken}
              onChangeText={setAuthToken}
              placeholder="Token"
              placeholderTextColor={c.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showToken}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowToken((value) => !value)}>
              <Text style={styles.eyeText}>{showToken ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.testRow}>
            <TouchableOpacity
              style={[styles.testBtn, (!tursoComplete || testState.kind === 'testing') && { opacity: 0.5 }]}
              disabled={!tursoComplete || testState.kind === 'testing'}
              onPress={() => void handleTest()}
            >
              <Text style={styles.testBtnText}>
                {testState.kind === 'testing' ? 'Testing…' : 'Test connection'}
              </Text>
            </TouchableOpacity>
            {testState.message ? (
              <Text
                style={[styles.testResult, { color: testState.kind === 'ok' ? c.income : c.danger }]}
                numberOfLines={2}
              >
                {testState.message}
              </Text>
            ) : null}
          </View>
          <Text style={styles.hint}>
            Credentials are stored only on this device and used to reach your own Turso database.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveBtn, busy && { opacity: 0.5 }]}
        disabled={busy}
        onPress={() => void handleSave()}
      >
        <Text style={styles.saveText}>Save storage settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 12,
      marginBottom: 8
    },
    cardTitle: { color: c.text, fontWeight: '800', fontSize: 16 },
    activeCard: { backgroundColor: c.surface2, borderRadius: radius.md, borderLeftWidth: 3, padding: 12, gap: 4 },
    activeText: { color: c.text, fontWeight: '800', fontSize: 13 },
    activeHint: { color: c.textMuted, fontSize: 12 },
    modeGrid: { flexDirection: 'row', gap: 10 },
    modeCard: {
      flex: 1,
      backgroundColor: c.surface2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      padding: 12,
      gap: 4
    },
    modeCardActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    modeCardDisabled: { opacity: 0.45 },
    modeTitle: { color: c.text, fontWeight: '800', fontSize: 14 },
    modeDesc: { color: c.textMuted, fontSize: 11 },
    config: { gap: 8 },
    label: { color: c.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    field: {
      backgroundColor: c.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 11
    },
    tokenRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    eyeBtn: { backgroundColor: c.surface2, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11 },
    eyeText: { fontSize: 16 },
    testRow: { gap: 6 },
    testBtn: { backgroundColor: c.surface2, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
    testBtnText: { color: c.accentText, fontWeight: '800' },
    testResult: { fontSize: 12, fontWeight: '600' },
    hint: { color: c.textDim, fontSize: 11 },
    saveBtn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
    saveText: { color: '#fff', fontWeight: '800' }
  });
