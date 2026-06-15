import type { Transaction, TransactionType } from './finance';

const TRANSACTION_HEADERS = [
  'id',
  'date',
  'type',
  'amount',
  'currency',
  'account',
  'category',
  'note',
  'createdAt',
  'createdBy',
  'source',
  'deleted',
  'updatedAt',
  'receiptUrl'
] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function parseBoolean(value: string | undefined) {
  return String(value ?? '').toUpperCase() === 'TRUE';
}

function parseAmount(value: string): number {
  const cleaned = String(value ?? '').replace(/[^0-9.\-]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

/**
 * Parse a date that may be ISO (YYYY-MM-DD), or the Money Manager export style
 * "DD/MM/YYYY HH:MM:SS". Returns the date (YYYY-MM-DD), a full ISO timestamp,
 * and a numeric sort key. Falls back to "now" when unparseable.
 */
function parseFlexibleDate(value: string): { date: string; iso: string; sortKey: number } {
  const raw = String(value ?? '').trim();
  const now = new Date();

  if (!raw) {
    return { date: now.toISOString().slice(0, 10), iso: now.toISOString(), sortKey: now.getTime() };
  }

  const [datePart, timePart = ''] = raw.split(/[ T]/);

  if (datePart.includes('-')) {
    // Already ISO-ish (YYYY-MM-DD).
    const date = datePart.slice(0, 10);
    const iso = timePart ? `${date}T${timePart}` : `${date}T00:00:00`;
    const parsed = new Date(iso);
    return { date, iso, sortKey: Number.isNaN(parsed.getTime()) ? now.getTime() : parsed.getTime() };
  }

  if (datePart.includes('/')) {
    // DD/MM/YYYY
    const [dd, mm, yyyy] = datePart.split('/');
    const day = dd?.padStart(2, '0');
    const month = mm?.padStart(2, '0');
    if (yyyy && month && day) {
      const date = `${yyyy}-${month}-${day}`;
      const time = /^\d{1,2}:\d{2}/.test(timePart) ? timePart : '00:00:00';
      const iso = `${date}T${time}`;
      const parsed = new Date(iso);
      return { date, iso, sortKey: Number.isNaN(parsed.getTime()) ? now.getTime() : parsed.getTime() };
    }
  }

  return { date: now.toISOString().slice(0, 10), iso: now.toISOString(), sortKey: now.getTime() };
}

type Getter = (key: string) => string;

function makeGetter(row: string[], headerIndex: Map<string, number>): Getter {
  return (key: string) => row[headerIndex.get(key) ?? -1] ?? '';
}

function rowToNativeTransaction(get: Getter): Transaction | null {
  const id = get('id').trim();
  if (!id) return null;

  const type: TransactionType = get('type') === 'income' ? 'income' : 'expense';
  const amount = Number(get('amount'));

  return {
    id,
    date: get('date') || new Date().toISOString().slice(0, 10),
    type,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: get('currency') || 'INR',
    account: get('account') || 'Cash',
    category: get('category') || 'Other',
    note: get('note') || '',
    createdAt: get('createdAt') || new Date().toISOString(),
    createdBy: get('createdBy') || 'imported',
    source: get('source') === 'web' ? 'web' : 'mobile',
    deleted: parseBoolean(get('deleted')),
    updatedAt: get('updatedAt') || undefined,
    receiptUrl: get('receiptUrl') || undefined
  };
}

function classifyType(value: string): TransactionType | null {
  const lower = value.trim().toLowerCase();
  if (lower.includes('transfer')) return null; // skip transfers
  if (lower.includes('income') || lower === 'in') return 'income';
  if (lower.includes('expense') || lower.includes('expenditure') || lower === 'out') return 'expense';
  return null;
}

function rowToImportedTransaction(get: Getter, index: number): Transaction | null {
  const type = classifyType(get('income/expense'));
  if (!type) return null;

  const { date, iso, sortKey } = parseFlexibleDate(get('date'));
  const amount = parseAmount(get('amount') || get('inr'));
  if (amount <= 0) return null;

  const subcategory = get('subcategory').trim();
  const category = get('category').trim() || 'Other';
  const noteParts = [get('note').trim(), get('description').trim(), subcategory].filter(Boolean);

  return {
    id: `imp-${sortKey}-${index}`,
    date,
    type,
    amount,
    currency: (get('currency').trim() || 'INR').toUpperCase(),
    account: get('account').trim() || 'Cash',
    category,
    note: noteParts.join(' · '),
    createdAt: iso,
    createdBy: 'imported',
    source: 'web',
    deleted: false
  };
}

export function parseTransactionsCsv(csvText: string): Transaction[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('The selected file is empty.');
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const headerIndex = new Map<string, number>();
  // Keep the FIRST occurrence of each header (some exports repeat "Account").
  headerCells.forEach((name, index) => {
    if (!headerIndex.has(name)) headerIndex.set(name, index);
  });

  const isNative = headerIndex.has('id') && headerIndex.has('type');
  const isImported = headerIndex.has('date') && (headerIndex.has('income/expense') || headerIndex.has('amount') || headerIndex.has('inr'));

  if (!isNative && !isImported) {
    throw new Error('Unrecognized CSV. Use a Money Sheets export, or a sheet with Date, Category, Amount and Income/Expense columns.');
  }

  const dataRows = lines.slice(1).map((line) => parseCsvLine(line));

  const transactions = isNative
    ? dataRows
        .map((row) => rowToNativeTransaction(makeGetter(row, headerIndex)))
        .filter((row): row is Transaction => Boolean(row))
    : dataRows
        .map((row, index) => rowToImportedTransaction(makeGetter(row, headerIndex), index))
        .filter((row): row is Transaction => Boolean(row));

  if (transactions.length === 0) {
    throw new Error('No valid transaction rows found in the CSV file.');
  }

  // Sort chronologically by date (and time when available) instead of by id.
  transactions.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.createdAt.localeCompare(right.createdAt);
  });

  return transactions;
}

export function validateImportFileName(name: string) {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.csv')) {
    throw new Error('Please choose a .csv file exported from Money Sheets or matching the export format.');
  }
}

export { TRANSACTION_HEADERS };
