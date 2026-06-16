import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { useTheme } from '../theme/ThemeProvider';

const PRESET_COLORS = [
  '#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff',
  '#ff7a45', '#22c3e6', '#f2495c', '#7ed957', '#c44dff',
  '#f59e0b', '#60a5fa', '#34d399', '#fb923c', '#a78bfa'
];

const PRESET_EMOJIS = ['🛒', '🍜', '⛽', '👫', '🛠️', '👕', '🩺', '📦', '💸', '📒', '✈️', '💰', '🎁', '💵', '🏦', '🐷', '🎬', '🏠', '💊', '📱'];

export type EntityEditorValue = {
  name: string;
  emoji: string;
  color: string;
  currency?: string;
  openingBalance?: string;
};

/**
 * Bottom-sheet editor for a category or account: rename, pick emoji and color,
 * plus currency/opening balance when `showAccountFields` is set.
 */
export function EntityEditorModal({
  visible,
  title,
  initial,
  showAccountFields,
  onSave,
  onClose
}: {
  visible: boolean;
  title: string;
  initial: EntityEditorValue;
  showAccountFields?: boolean;
  onSave: (value: EntityEditorValue) => void;
  onClose: () => void;
}) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const [currency, setCurrency] = useState(initial.currency ?? 'INR');
  const [openingBalance, setOpeningBalance] = useState(initial.openingBalance ?? '');

  useEffect(() => {
    if (visible) {
      setName(initial.name);
      setEmoji(initial.emoji);
      setColor(initial.color);
      setCurrency(initial.currency ?? 'INR');
      setOpeningBalance(initial.openingBalance ?? '');
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            <View style={styles.previewRow}>
              <View style={[styles.preview, { backgroundColor: `${color}22`, borderColor: color }]}>
                <Text style={styles.previewEmoji}>{emoji || '🏷️'}</Text>
              </View>
              <Text style={styles.previewName}>{name || 'Name'}</Text>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.field}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={c.textDim}
            />

            <Text style={styles.label}>Emoji</Text>
            <TextInput
              style={[styles.field, styles.emojiField]}
              value={emoji}
              onChangeText={(text) => setEmoji([...text][0] ?? '')}
              placeholder="Pick or type one emoji"
              placeholderTextColor={c.textDim}
            />
            <View style={styles.emojiGrid}>
              {PRESET_EMOJIS.map((option) => (
                <TouchableOpacity key={option} style={styles.emojiChip} onPress={() => setEmoji(option)}>
                  <Text style={styles.emojiChipText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: option },
                    color === option && styles.colorSwatchActive
                  ]}
                  onPress={() => setColor(option)}
                />
              ))}
            </View>

            {showAccountFields ? (
              <>
                <Text style={styles.label}>Currency</Text>
                <TextInput
                  style={styles.field}
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="INR"
                  placeholderTextColor={c.textDim}
                  autoCapitalize="characters"
                />
                <Text style={styles.label}>Opening balance</Text>
                <TextInput
                  style={styles.field}
                  value={openingBalance}
                  onChangeText={setOpeningBalance}
                  placeholder="0"
                  placeholderTextColor={c.textDim}
                  keyboardType="decimal-pad"
                />
              </>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !name.trim() && { opacity: 0.45 }]}
              disabled={!name.trim()}
              onPress={() => onSave({ name: name.trim(), emoji, color, currency, openingBalance })}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      gap: 12,
      maxHeight: '88%'
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
    title: { color: c.text, fontSize: 17, fontWeight: '800' },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    preview: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    previewEmoji: { fontSize: 22 },
    previewName: { color: c.text, fontSize: 16, fontWeight: '700' },
    label: { color: c.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    field: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 12
    },
    emojiField: { fontSize: 18 },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiChip: { backgroundColor: c.surface, borderRadius: radius.sm, padding: 8, borderWidth: 1, borderColor: c.border },
    emojiChipText: { fontSize: 18 },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorSwatch: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
    colorSwatchActive: { borderColor: c.text },
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md, backgroundColor: c.surface },
    cancelText: { color: c.textMuted, fontWeight: '800' },
    saveBtn: { flex: 1.6, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md, backgroundColor: c.accent },
    saveText: { color: '#fff', fontWeight: '800' }
  });
