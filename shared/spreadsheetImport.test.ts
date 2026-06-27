import { describe, expect, it } from 'vitest';
import { isNativeHeaderRow, resolveTransactionImportSheet } from './spreadsheetImport';
import { EXPORT_HEADERS } from './finance';

const nativeHeader = [...EXPORT_HEADERS];
const summaryHeader = ['Month', 'Income', 'Expense', 'Net', 'Transaction Count'];
const foreignHeader = ['Date', 'Category', 'Amount', 'Note'];

function headerLookup(map: Record<string, string[]>) {
  return (name: string) => map[name] ?? [];
}

describe('isNativeHeaderRow', () => {
  it('accepts the native export header', () => {
    expect(isNativeHeaderRow(nativeHeader)).toBe(true);
  });
  it('rejects the summary header', () => {
    expect(isNativeHeaderRow(summaryHeader)).toBe(false);
  });
});

describe('resolveTransactionImportSheet', () => {
  it('prefers the new All Transactions master sheet', () => {
    const names = ['All Transactions', '2025-01', '2025-02', 'Summary'];
    const chosen = resolveTransactionImportSheet(
      names,
      headerLookup({
        'All Transactions': nativeHeader,
        '2025-01': nativeHeader,
        '2025-02': nativeHeader,
        Summary: summaryHeader
      })
    );
    expect(chosen).toBe('All Transactions');
  });

  it('falls back to the legacy Transactions sheet name', () => {
    const names = ['Transactions', 'Notes'];
    const chosen = resolveTransactionImportSheet(
      names,
      headerLookup({ Transactions: nativeHeader, Notes: foreignHeader })
    );
    expect(chosen).toBe('Transactions');
  });

  it('returns the single sheet for legacy/foreign single-sheet workbooks', () => {
    expect(resolveTransactionImportSheet(['Sheet1'], headerLookup({ Sheet1: foreignHeader }))).toBe('Sheet1');
  });

  it('skips Summary and picks the first native sheet when no master is named', () => {
    const names = ['Summary', 'Custom', 'Other'];
    const chosen = resolveTransactionImportSheet(
      names,
      headerLookup({ Summary: summaryHeader, Custom: nativeHeader, Other: nativeHeader })
    );
    expect(chosen).toBe('Custom');
  });

  it('falls back to the first sheet when nothing matches', () => {
    const names = ['One', 'Two'];
    const chosen = resolveTransactionImportSheet(
      names,
      headerLookup({ One: foreignHeader, Two: foreignHeader })
    );
    expect(chosen).toBe('One');
  });

  it('returns null for an empty workbook', () => {
    expect(resolveTransactionImportSheet([], headerLookup({}))).toBeNull();
  });
});
