/**
 * Picks which worksheet to import transactions from, so multi-sheet workbooks
 * (produced by the new export) still import the master sheet rather than the
 * first sheet by position.
 *
 * Resolution order:
 *   1. "All Transactions" (new export master sheet)
 *   2. "Transactions" (legacy single-sheet export)
 *   3. First non-Summary sheet whose header row looks like the native format
 *   4. Fall back to the first sheet (preserves legacy/foreign single-sheet imports)
 *
 * Only the sheet name is returned; the existing CSV parser handles the actual
 * format detection (native vs. Money Manager, etc).
 */
import { SHEET_ALL_TRANSACTIONS, SHEET_LEGACY_TRANSACTIONS, SHEET_SUMMARY } from './spreadsheetExport';

/** A header row is "native" when it carries the id/type/amount columns. */
export function isNativeHeaderRow(headerRow: string[]): boolean {
  const normalized = new Set(headerRow.map((cell) => String(cell).trim().toLowerCase()));
  return normalized.has('id') && normalized.has('type') && normalized.has('amount');
}

export function resolveTransactionImportSheet(
  sheetNames: string[],
  getHeaderRow: (sheetName: string) => string[]
): string | null {
  if (sheetNames.length === 0) return null;
  // Single-sheet workbooks (legacy native exports and foreign formats like
  // Money Manager) always import that one sheet.
  if (sheetNames.length === 1) return sheetNames[0];

  if (sheetNames.includes(SHEET_ALL_TRANSACTIONS)) return SHEET_ALL_TRANSACTIONS;
  if (sheetNames.includes(SHEET_LEGACY_TRANSACTIONS)) return SHEET_LEGACY_TRANSACTIONS;

  for (const name of sheetNames) {
    if (name === SHEET_SUMMARY) continue;
    if (isNativeHeaderRow(getHeaderRow(name))) return name;
  }

  return sheetNames[0];
}
