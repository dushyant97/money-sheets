import type { Transaction } from './finance';

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

function rowToTransaction(row: string[], headerIndex: Map<string, number>): Transaction | null {
  const get = (key: string) => row[headerIndex.get(key) ?? -1] ?? '';
  const id = get('id').trim();
  if (!id) return null;

  const type = get('type') === 'income' ? 'income' : 'expense';
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
  headerCells.forEach((name, index) => headerIndex.set(name, index));

  const required = ['id', 'date', 'type', 'amount'];
  for (const column of required) {
    if (!headerIndex.has(column)) {
      throw new Error(`CSV is missing required column: ${column}`);
    }
  }

  const transactions = lines
    .slice(1)
    .map((line) => rowToTransaction(parseCsvLine(line), headerIndex))
    .filter((row): row is Transaction => Boolean(row));

  if (transactions.length === 0) {
    throw new Error('No valid transaction rows found in the CSV file.');
  }

  return transactions;
}

export function validateImportFileName(name: string) {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.csv')) {
    throw new Error('Please choose a .csv file exported from Money Sheets or matching the export format.');
  }
}

export { TRANSACTION_HEADERS };
