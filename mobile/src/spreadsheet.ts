// SDK 54+ moved the synchronous read/write helpers used here to the legacy
// entry; the new File/Directory API isn't needed for simple cache writes.
import * as FileSystem from 'expo-file-system/legacy';
import type { Transaction } from '../../shared/finance';
import { exportTransactionsCsv, transactionsToRows } from '../../shared/finance';
import { parseTransactionsCsvProgressive } from '../../shared/csvImport';

// SheetJS is heavy, so load it on demand the first time the user imports or
// exports an Excel file. CSV-only flows never pay the bundle cost.
const loadXlsx = () => import('xlsx');

/** Reports import progress as a fraction in the 0..1 range. */
export type ImportProgress = (fraction: number) => void;

function isExcelName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm') || lower.endsWith('.xlsb');
}

/**
 * Read transactions from a picked file URI. Accepts `.csv` as well as Excel
 * workbooks; Excel is decoded in-memory to CSV text and reuses the same
 * format-detection/parsing logic. `onProgress` drives a percentage indicator.
 */
export async function readTransactionsFromUri(
  uri: string,
  fileName: string,
  onProgress?: ImportProgress
): Promise<Transaction[]> {
  const READ_PHASE = 0.25;
  const reportParse = onProgress
    ? (fraction: number) => onProgress(READ_PHASE + fraction * (1 - READ_PHASE))
    : undefined;

  if (isExcelName(fileName)) {
    onProgress?.(0.04);
    const XLSX = await loadXlsx();
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    onProgress?.(0.12);
    const workbook = XLSX.read(base64, { type: 'base64', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('The workbook has no sheets.');
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], { blankrows: false });
    onProgress?.(READ_PHASE);
    return parseTransactionsCsvProgressive(csv, reportParse);
  }

  onProgress?.(0.05);
  const text = await FileSystem.readAsStringAsync(uri);
  onProgress?.(READ_PHASE);
  return parseTransactionsCsvProgressive(text, reportParse);
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/** Write a CSV of all transactions to the cache and open the share sheet. */
export async function shareTransactionsCsv(filename: string, transactions: Transaction[]): Promise<void> {
  const csv = exportTransactionsCsv(transactions);
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(uri, 'text/csv', 'Export transactions (CSV)');
}

/** Write an `.xlsx` workbook of all transactions to the cache and share it. */
export async function shareTransactionsXlsx(filename: string, transactions: Transaction[]): Promise<void> {
  const XLSX = await loadXlsx();
  const rows = transactionsToRows(transactions);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const widths = [24, 12, 9, 12, 9, 18, 18, 28, 22, 14, 8, 9, 22, 20];
  sheet['!cols'] = widths.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await shareFile(
    uri,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Export transactions (Excel)'
  );
}
