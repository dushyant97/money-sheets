import React, { useMemo, useState } from 'react';
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
import { radius, type ThemePalette } from '../../../shared/theme';
import { getCategoryMeta } from '../../../shared/uiHelpers';
import { Calculator } from '../components/Calculator';
import { DatePicker } from '../components/DatePicker';
import { useTheme } from '../theme/ThemeProvider';
import { useLedger } from '../context/LedgerContext';

/** `YYYY-MM-DD` -> `DD/MM/YYYY` for the typed date field. */
function toDisplayDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

/** Format raw typing into `DD/MM/YYYY`, auto-inserting the `/` delimiters. */
function formatTypedDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
}

/** Parse a `DD/MM/YYYY` string to a stored `YYYY-MM-DD` key, or null when invalid. */
function parseTypedDate(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (year < 1 || month < 1 || month > 12) return null;
  const daysInThatMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInThatMonth) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function AddTransactionScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { showAdd, editingId, form, categories, accounts, transactions, busy, setForm, saveTransaction, cancelEdit } =
    useLedger();

  const expenseCategories = categories.filter((category) => category.active && category.type === 'expense');
  const incomeCategories = categories.filter((category) => category.active && category.type === 'income');
  const activeCategories = form.type === 'income' ? incomeCategories : expenseCategories;
  const activeAccounts = accounts.filter((account) => account.active);
  const incomeDefault = incomeCategories[0]?.name ?? 'Salary';
  const expenseDefault = expenseCategories[0]?.name ?? 'Misc';
  const [showCalc, setShowCalc] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [dateText, setDateText] = useState(() => toDisplayDate(form.date));
  const [descFocused, setDescFocused] = useState(false);

  React.useEffect(() => {
    if (showAdd && !activeCategories.some((category) => category.name === form.category)) {
      setForm((current) => ({ ...current, category: activeCategories[0]?.name ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, form.type, form.category, categories]);

  // Keep the typed date field in sync with the stored value (calendar pick / edit).
  React.useEffect(() => {
    setDateText(toDisplayDate(form.date));
  }, [form.date]);

  function handleDateType(raw: string) {
    const formatted = formatTypedDate(raw);
    setDateText(formatted);
    const iso = parseTypedDate(formatted);
    if (iso) setForm((current) => ({ ...current, date: iso }));
  }

  function handleDateBlur() {
    if (parseTypedDate(dateText) === null) setDateText(toDisplayDate(form.date));
  }

  const noteQuery = form.note.trim().toLowerCase();
  const noteSuggestions = noteQuery
    ? Array.from(
        new Set(
          transactions
            .filter(
              (t) => !t.deleted && t.note && t.note.toLowerCase().includes(noteQuery) && t.note.trim().toLowerCase() !== noteQuery
            )
            .map((t) => t.note.trim())
        )
      ).slice(0, 6)
    : [];

  return (
    <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancelEdit}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Edit record' : 'Add record'}</Text>
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

          <Text style={styles.section}>Amount</Text>
          <View style={styles.amountCard}>
            <Text style={styles.currencyMark}>{form.currency === 'INR' ? '₹' : form.currency === 'USD' ? '$' : form.currency}</Text>
            <TextInput
              style={[styles.amountInput, { color: form.type === 'income' ? c.income : c.expense }]}
              value={form.amount}
              onChangeText={(text) => setForm((current) => ({ ...current, amount: text.replace(/[^0-9.]/g, '') }))}
              placeholder="0"
              placeholderTextColor={c.textDim}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.calcBtn} onPress={() => setShowCalc(true)} accessibilityLabel="Open calculator">
              <Text style={styles.calcBtnText}>🧮</Text>
            </TouchableOpacity>
          </View>

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
            {activeCategories.map((category) => {
              const meta = getCategoryMeta(category.name);
              const active = form.category === category.name;
              return (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.chip,
                    { borderColor: active ? meta.color : 'transparent', backgroundColor: active ? `${meta.color}22` : c.surface }
                  ]}
                  onPress={() => setForm({ ...form, category: category.name })}
                >
                  <Text style={[styles.chipText, { color: active ? c.text : c.textMuted }]}>
                    {meta.emoji} {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
          <View style={styles.dateField}>
            <Text style={styles.dateIcon}>📅</Text>
            <TextInput
              style={styles.dateInput}
              value={dateText}
              onChangeText={handleDateType}
              onBlur={handleDateBlur}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={c.textDim}
              keyboardType="number-pad"
            />
            <TouchableOpacity onPress={() => setShowDate(true)} hitSlop={8} accessibilityLabel="Open calendar">
              <Text style={styles.dateChevron}>▾</Text>
            </TouchableOpacity>
          </View>

          <DatePicker
            visible={showDate}
            value={form.date}
            onSelect={(date) => setForm({ ...form, date })}
            onClose={() => setShowDate(false)}
          />

          <Text style={styles.section}>Description</Text>
          <TextInput
            style={[styles.field, styles.memo]}
            value={form.note}
            onChangeText={(note) => setForm({ ...form, note })}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setTimeout(() => setDescFocused(false), 150)}
            placeholder="Optional description"
            placeholderTextColor={c.textDim}
            multiline
          />
          {descFocused && noteSuggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              {noteSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestItem}
                  onPress={() => setForm({ ...form, note: suggestion })}
                >
                  <Text style={[styles.suggestText, { color: c.text }]} numberOfLines={1}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={styles.section}>Receipt link</Text>
          <TextInput
            style={styles.field}
            value={form.receiptUrl ?? ''}
            onChangeText={(receiptUrl) => setForm({ ...form, receiptUrl })}
            placeholder="https://..."
            placeholderTextColor={c.textDim}
            autoCapitalize="none"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemePalette) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: c.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border
    },
    cancel: { color: c.textMuted, fontWeight: '600' },
    title: { color: c.text, fontWeight: '800', fontSize: 16 },
    save: { color: c.accentText, fontWeight: '800' },
    saveDisabled: { opacity: 0.4 },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center'
    },
    typeBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    typeText: { color: c.textMuted, fontWeight: '800' },
    typeTextActive: { color: c.accentText },
    amountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    currencyMark: { color: c.textMuted, fontSize: 26, fontWeight: '800' },
    amountInput: { flex: 1, fontSize: 36, fontWeight: '900', letterSpacing: -1, paddingVertical: 6 },
    calcBtn: { backgroundColor: c.accentSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
    calcBtnText: { fontSize: 18 },
    section: { color: c.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'transparent'
    },
    chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
    chipTextActive: { color: c.accentText },
    dateField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    dateIcon: { fontSize: 18 },
    dateInput: { flex: 1, color: c.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.5, paddingVertical: 2 },
    dateChevron: { color: c.textDim, fontSize: 18 },
    field: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 12
    },
    memo: { minHeight: 80, textAlignVertical: 'top' },
    suggestBox: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: -6,
      overflow: 'hidden'
    },
    suggestItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    suggestText: { fontSize: 14 }
  });
