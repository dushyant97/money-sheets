import type { Transaction } from '../../shared/finance';
import { parseTransactionsCsvProgressive } from '../../shared/csvImport';
import { buildTransactionsWorkbook, columnWidthsForSheet } from '../../shared/spreadsheetExport';
import { resolveTransactionImportSheet } from '../../shared/spreadsheetImport';

// SheetJS is heavy, so load it on demand the first time the user imports or
// exports an Excel file. This keeps it out of the initial app bundle.
const loadXlsx = () => import('xlsx');
type Xlsx = typeof import('xlsx');

/** Fixed workbook filename for the default-location export. */
export const EXPORT_FILENAME = 'money-sheets.xlsx';

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
    if (workbook.SheetNames.length === 0) {
      throw new Error('The workbook has no sheets.');
    }
    // Pick the master transaction sheet by name/header so multi-sheet exports
    // (All Transactions + monthly + Summary) import correctly rather than just
    // reading the first sheet by position.
    const getHeaderRow = (name: string): string[] => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        blankrows: false
      }) as unknown[][];
      return (rows[0] ?? []).map((cell) => String(cell ?? ''));
    };
    const sheetName = resolveTransactionImportSheet(workbook.SheetNames, getHeaderRow);
    if (!sheetName) {
      throw new Error('The workbook has no sheets.');
    }
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    onProgress?.(READ_PHASE);
    return parseTransactionsCsvProgressive(csv, reportParse);
  }

  onProgress?.(0.05);
  const text = await file.text();
  onProgress?.(READ_PHASE);
  return parseTransactionsCsvProgressive(text, reportParse);
}

/** Reports export progress as a fraction in the 0..1 range. */
export type ExportProgress = (fraction: number) => void;

/**
 * Where the exported workbook is written:
 *  - `default`: browser download to the Downloads folder.
 *  - `picker`: a `FileSystemFileHandle` the caller obtained from
 *    `showSaveFilePicker`, letting the user replace a chosen file in place.
 */
export type ExportDestination =
  | { mode: 'default' }
  | { mode: 'picker'; handle: FileSystemFileHandle };

export type ExportOptions = {
  onProgress?: ExportProgress;
  destination?: ExportDestination;
};

/** True when the browser supports the File System Access save picker. */
export function canPickSaveLocation(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/** Assemble a SheetJS workbook from the platform-agnostic payload. */
function payloadToWorkbook(XLSX: Xlsx, transactions: Transaction[], onProgress?: ExportProgress) {
  const { sheets } = buildTransactionsWorkbook(transactions);
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    const widths = columnWidthsForSheet(sheet.name);
    if (widths) worksheet['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    // Building sheets occupies the 0.20–0.70 slice of the progress bar.
    onProgress?.(0.2 + ((index + 1) / sheets.length) * 0.5);
  });

  return workbook;
}

/** Write a built workbook to the chosen destination. */
async function writeWorkbook(
  XLSX: Xlsx,
  workbook: ReturnType<Xlsx['utils']['book_new']>,
  destination: ExportDestination
) {
  if (destination.mode === 'picker') {
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const writable = await destination.handle.createWritable();
    await writable.write(buffer);
    await writable.close();
    return;
  }
  XLSX.writeFile(workbook, EXPORT_FILENAME, { bookType: 'xlsx' });
}

/**
 * Build and save the multi-sheet `.xlsx` workbook (All Transactions + one sheet
 * per month + Summary). `onProgress` drives the export overlay; `destination`
 * selects the default download or a user-picked file location.
 */
export async function exportTransactionsXlsx(transactions: Transaction[], options: ExportOptions = {}) {
  const { onProgress, destination = { mode: 'default' } } = options;
  onProgress?.(0.05);
  const XLSX = await loadXlsx();
  onProgress?.(0.2);
  const workbook = payloadToWorkbook(XLSX, transactions, onProgress);
  onProgress?.(0.9);
  await writeWorkbook(XLSX, workbook, destination);
  onProgress?.(1);
}
