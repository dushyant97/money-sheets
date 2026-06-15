import type { Transaction } from '../../shared/finance';
import { transactionsToRows } from '../../shared/finance';
import { parseTransactionsCsv } from '../../shared/csvImport';

// SheetJS is heavy, so load it on demand the first time the user imports or
// exports an Excel file. This keeps it out of the initial app bundle.
const loadXlsx = () => import('xlsx');

function isExcelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.xlsb');
}

/**
 * Read transactions from a user-selected file. Accepts `.csv` as well as Excel
 * workbooks (`.xlsx` / `.xls`). Excel is converted to CSV text in-memory and
 * reuses the same format-detection/parsing logic as direct CSV imports.
 */
export async function readTransactionsFromFile(file: File): Promise<Transaction[]> {
  if (isExcelFile(file)) {
    const XLSX = await loadXlsx();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The workbook has no sheets.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return parseTransactionsCsv(csv);
  }

  const text = await file.text();
  return parseTransactionsCsv(text);
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
