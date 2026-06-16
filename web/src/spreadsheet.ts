import type { Transaction } from '../../shared/finance';
import { transactionsToRows } from '../../shared/finance';
import { parseTransactionsCsvProgressive } from '../../shared/csvImport';

// SheetJS is heavy, so load it on demand the first time the user imports or
// exports an Excel file. This keeps it out of the initial app bundle.
const loadXlsx = () => import('xlsx');

function isExcelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.xlsb');
}

/** Reports import progress as a fraction in the 0..1 range. */
export type ImportProgress = (fraction: number) => void;

/**
 * Read transactions from a user-selected file. Accepts `.csv` as well as Excel
 * workbooks (`.xlsx` / `.xls`). Excel is converted to CSV text in-memory and
 * reuses the same format-detection/parsing logic as direct CSV imports.
 *
 * `onProgress` is invoked with the overall completion fraction so large files
 * can drive a percentage indicator. Reading/decoding the file occupies the first
 * slice of the bar; row parsing fills the rest.
 */
export async function readTransactionsFromFile(file: File, onProgress?: ImportProgress): Promise<Transaction[]> {
  // Parsing rows is the bulk of the work, so the read/decode phase only takes
  // the first slice of the bar and parsing covers the rest.
  const READ_PHASE = 0.25;
  const reportParse = onProgress
    ? (fraction: number) => onProgress(READ_PHASE + fraction * (1 - READ_PHASE))
    : undefined;

  if (isExcelFile(file)) {
    onProgress?.(0.04);
    const XLSX = await loadXlsx();
    onProgress?.(0.1);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The workbook has no sheets.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    onProgress?.(READ_PHASE);
    return parseTransactionsCsvProgressive(csv, reportParse);
  }

  onProgress?.(0.05);
  const text = await file.text();
  onProgress?.(READ_PHASE);
  return parseTransactionsCsvProgressive(text, reportParse);
}

/** Build and download an `.xlsx` workbook of all transactions. */
export async function exportTransactionsXlsx(filename: string, transactions: Transaction[]) {
  const XLSX = await loadXlsx();
  const rows = transactionsToRows(transactions);
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  const widths = [24, 12, 9, 12, 9, 18, 18, 28, 22, 14, 8, 9, 22, 20];
  sheet['!cols'] = widths.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
}
