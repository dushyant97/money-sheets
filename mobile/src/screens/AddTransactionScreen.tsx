import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, radius } from '../../../shared/theme';
import { formatMoney, getCategoryMeta } from '../../../shared/uiHelpers';
import { Calculator } from '../components/Calculator';
import { useLedger } from '../context/LedgerContext';

export function AddTransactionScreen() {
  const {
    showAdd,
    editingId,
    form,
    categories,
    accounts,
    busy,
    setForm,
    setShowAdd,
    saveTransaction,
    cancelEdit
  } = useLedger();

  const expenseCategories = categories.filter((category) => category.active && category.type === 'expense');
  const incomeCategories = categories.filter((category) => category.active && category.type === 'income');
  const activeCategories = form.type === 'income' ? incomeCategories : expenseCategories;
  const activeAccounts = accounts.filter((account) => account.active);
  const displayAmount = form.amount ? Number(form.amount) : 0;
  const incomeDefault = incomeCategories[0]?.name ?? 'Salary';
  const expenseDefault = expenseCategories[0]?.name ?? 'Misc';
  const [showCalc, setShowCalc] = useState(false);

  React.useEffect(() => {
    if (showAdd && !activeCategories.some((category) => category.name === form.category)) {
      setForm((current) => ({ ...current, category: activeCategories[0]?.name ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, form.type, form.category, categories]);

  return (
    <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancelEdit}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Edit' : 'Add record'}</Text>
          <TouchableOpacity onPress={() => void saveTransaction()} disabled={busy || !form.amount.trim()}>
            <Text style={[styles.save, (!form.amount.trim() || busy) && styles.saveDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.typeRow}>
            {(['expense', 'income'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, form.type === type && styles.typeBtnActive]}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    type,
                    category: type === 'income' ? incomeDefault : expenseDefault
                  }))
                }
              >
                <Text style={[styles.typeText, form.type === type && styles.typeTextActive]}>
                  {type === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.amountCard} activeOpacity={0.8} onPress={() => setShowCalc(true)}>
            <Text style={styles.amountLabel}>Tap to enter amount with calculator</Text>
            <Text
              style={[
                styles.amountDisplay,
                form.type === 'income' ? styles.income : styles.expense
              ]}
            >
              {form.amount ? formatMoney(displayAmount, form.currency) : formatMoney(0, form.currency)}
            </Text>
            <Text style={styles.calcHint}>🧮 Calculator</Text>
          </TouchableOpacity>

          <Calculator
            visible={showCalc}
            initialValue={form.amount}
            currency={form.currency}
            onDone={(value) => {
              setForm((current) => ({ ...current, amount: value ? String(value) : '' }));
              setShowCalc(false);
            }}
            onCancel={() => setShowCalc(false)}
          />

          <Text style={styles.section}>Category</Text>
          <View style={styles.chips}>
            {activeCategories.map((category) => (
              <TouchableOpacity
                key={category.name}
                style={[styles.chip, form.category === category.name && styles.chipActive]}
                onPress={() => setForm({ ...form, category: category.name })}
              >
                <Text style={[styles.chipText, form.category === category.name && styles.chipTextActive]}>
                  {getCategoryMeta(category.name).emoji} {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.section}>Account</Text>
          <View style={styles.chips}>
            {activeAccounts.map((account) => (
              <TouchableOpacity
                key={account.name}
                style={[styles.chip, form.account === account.name && styles.chipActive]}
                onPress={() => setForm({ ...form, account: account.name, currency: account.currency })}
              >
                <Text style={[styles.chipText, form.account === account.name && styles.chipTextActive]}>
                  {account.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.section}>Date</Text>
          <TextInput
            style={styles.field}
            value={form.date}
            onChangeText={(date) => setForm({ ...form, date })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textDim}
          />

          <Text style={styles.section}>Memo</Text>
          <TextInput
            style={[styles.field, styles.memo]}
            value={form.note}
            onChangeText={(note) => setForm({ ...form, note })}
            placeholder="Optional note"
            placeholderTextColor={colors.textDim}
            multiline
          />

          <Text style={styles.section}>Receipt link</Text>
          <TextInput
            style={styles.field}
            value={form.receiptUrl ?? ''}
            onChangeText={(receiptUrl) => setForm({ ...form, receiptUrl })}
            placeholder="https://..."
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  cancel: { color: colors.textMuted, fontWeight: '600' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  save: { color: colors.accentText, fontWeight: '800' },
  saveDisabled: { opacity: 0.4 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  typeBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  typeText: { color: colors.textMuted, fontWeight: '800' },
  typeTextActive: { color: colors.accentText },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 4,
    alignItems: 'center'
  },
  amountLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountDisplay: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1
  },
  income: { color: colors.income },
  expense: { color: colors.expense },
  calcHint: {
    color: colors.accentText,
    backgroundColor: colors.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden'
  },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.accentText },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  memo: { minHeight: 80, textAlignVertical: 'top' }
});
