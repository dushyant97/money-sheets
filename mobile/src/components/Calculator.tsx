import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../../shared/theme';
import { formatMoney } from '../../../shared/uiHelpers';
import { applyCalcKey, evaluateExpression, OP_MAP } from '../../../shared/calc';

const KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['.', '0', '⌫', '+']
] as const;

export function Calculator({
  visible,
  initialValue,
  currency,
  onDone,
  onCancel
}: {
  visible: boolean;
  initialValue: string;
  currency: string;
  onDone: (value: number) => void;
  onCancel: () => void;
}) {
  const [expr, setExpr] = useState('');

  // Sync the expression each time the calculator opens.
  React.useEffect(() => {
    if (visible) {
      setExpr(initialValue && Number(initialValue) ? String(initialValue) : '');
    }
  }, [visible, initialValue]);

  const result = evaluateExpression(expr || '0');
  const hasOperator = /[+\-*/]/.test(expr.slice(1));

  const press = (key: string) => setExpr((current) => applyCalcKey(current, key));
  const clearAll = () => setExpr('');
  const done = () => onDone(result < 0 ? 0 : result);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.display}>
            <Text style={styles.expr} numberOfLines={1}>{expr || '0'}</Text>
            <Text style={styles.result} numberOfLines={1}>
              {hasOperator ? '= ' : ''}
              {formatMoney(result, currency)}
            </Text>
          </View>

          <View style={styles.keys}>
            {KEYS.flat().map((key) => {
              const isOp = key in OP_MAP;
              const isFn = key === '⌫';
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.key, isOp && styles.keyOp]}
                  onPress={() => press(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.keyText, isOp && styles.keyTextOp, isFn && styles.keyTextFn]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.key, styles.clear]} onPress={clearAll} activeOpacity={0.7}>
              <Text style={styles.keyTextFn}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.key, styles.done]} onPress={done} activeOpacity={0.85}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,10,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12
  },
  display: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    minHeight: 84,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 6
  },
  expr: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  result: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    width: '23%',
    aspectRatio: 1.4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyOp: { backgroundColor: colors.surface2 },
  keyText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  keyTextOp: { color: colors.accent2 },
  keyTextFn: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  clear: { flex: 1, aspectRatio: undefined, paddingVertical: 16, width: undefined },
  done: {
    flex: 1.6,
    aspectRatio: undefined,
    paddingVertical: 16,
    width: undefined,
    backgroundColor: colors.accent
  },
  doneText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
