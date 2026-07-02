import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { radius, type ThemePalette } from '../../../shared/theme';
import { getCategoryMeta } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

export type CategoryOption = { name: string; count?: number };

/** Sentinel value meaning "no category filter" (show everything). */
export const ALL_CATEGORIES = '';

/**
 * Bottom sheet for picking the active category filter. Includes an "All
 * Categories" option, a search field, and a radio-style selectable list.
 */
export function CategoryFilterSheet({
  visible,
  categories,
  selected,
  onSelect,
  onClose
}: {
  visible: boolean;
  categories: CategoryOption[];
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((option) => option.name.toLowerCase().includes(q));
  }, [categories, query]);

  function choose(name: string) {
    onSelect(name);
    onClose();
  }

  const renderRow = (name: string, emoji: string, color: string, key: string, count?: number) => {
    const isSelected = selected === (name === 'All Categories' ? ALL_CATEGORIES : name);
    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.7}
        style={[styles.row, isSelected && { backgroundColor: c.accentSoft }]}
        onPress={() => choose(name === 'All Categories' ? ALL_CATEGORIES : name)}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${color}22` }]}>
          <Text style={styles.rowEmoji}>{emoji}</Text>
        </View>
        <Text style={[styles.rowName, { color: isSelected ? c.text : c.textMuted }]} numberOfLines={1}>
          {name}
        </Text>
        {typeof count === 'number' ? <Text style={[styles.rowCount, { color: c.textDim }]}>{count}</Text> : null}
        <View style={[styles.radio, { borderColor: isSelected ? c.accent : c.border }]}>
          {isSelected ? <View style={[styles.radioDot, { backgroundColor: c.accent }]} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Choose Category</Text>
          <Text style={styles.subtitle}>Filter transactions by category</Text>

          <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories"
              placeholderTextColor={c.textDim}
              autoCapitalize="none"
            />
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!query.trim() ? renderRow('All Categories', '📁', c.accent, '__all__') : null}
            {filtered.map((option) => {
              const meta = getCategoryMeta(option.name);
              return renderRow(option.name, meta.emoji, meta.color, option.name, option.count);
            })}
            {filtered.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>No categories match “{query}”.</Text>
            ) : null}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.66)', justifyContent: 'flex-end' },
    sheet: {
      height: '76%',
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 20
    },
    grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 14 },
    title: { color: c.text, fontSize: 20, fontWeight: '800' },
    subtitle: { color: c.textMuted, fontSize: 13, marginTop: 2, marginBottom: 14 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: 14,
      height: 46,
      marginBottom: 8
    },
    searchIcon: { fontSize: 14 },
    searchInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 },
    list: { flex: 1 },
    listContent: { paddingVertical: 4, paddingBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: radius.lg
    },
    rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    rowEmoji: { fontSize: 19 },
    rowName: { flex: 1, fontSize: 16, fontWeight: '600' },
    rowCount: { fontSize: 13, fontWeight: '600' },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 11, height: 11, borderRadius: 6 },
    empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 }
  });
