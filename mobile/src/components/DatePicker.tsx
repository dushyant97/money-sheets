import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius } from '../../../shared/theme';
import { buildCalendarMonth, dateKey } from '../../../shared/finance';
import { monthTitle } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Calendar modal for picking a transaction date (no raw text entry). */
export function DatePicker({
  visible,
  value,
  onSelect,
  onClose
}: {
  visible: boolean;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const { palette: c } = useTheme();
  const [view, setView] = useState(() => new Date(`${value}T00:00:00`));

  React.useEffect(() => {
    if (visible) setView(new Date(`${value}T00:00:00`));
  }, [visible, value]);

  const days = useMemo(() => buildCalendarMonth([], view.getFullYear(), view.getMonth()), [view]);
  const todayKey = dateKey();

  function shift(delta: number) {
    setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.head}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
              <Text style={[styles.arrow, { color: c.text }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: c.text }]}>{monthTitle(view.getFullYear(), view.getMonth())}</Text>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
              <Text style={[styles.arrow, { color: c.text }]}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}-${i}`} style={[styles.weekday, { color: c.textDim }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((day) => {
              const selected = day.date === value;
              const isToday = day.date === todayKey;
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.cell,
                    !day.inMonth && { opacity: 0.32 },
                    selected && { backgroundColor: c.accent },
                    !selected && isToday && { borderColor: c.warn, borderWidth: 1.5, backgroundColor: `${c.warn}22` }
                  ]}
                  onPress={() => {
                    onSelect(day.date);
                    onClose();
                  }}
                >
                  <Text style={[styles.cellText, { color: selected ? '#fff' : c.text }]}>{day.day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 24, fontWeight: '700', paddingHorizontal: 10 },
  title: { fontSize: 15, fontWeight: '800' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekday: { fontSize: 11, fontWeight: '800', width: 36, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: 'transparent'
  },
  cellText: { fontSize: 13, fontWeight: '600' }
});
