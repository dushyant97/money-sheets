/**
 * Platform-agnostic helpers that turn the in-memory transaction list into the
 * row data for the multi-sheet Excel workbook. No SheetJS import lives here so
 * the module stays safe to unit test and share across web/mobile.
 *
 * Workbook layout (see plan Part 1):
 *   1. "All Transactions" — every row, MUST stay at sheet index 0 so legacy
 *      positional importers keep reading the master sheet.
 *   2. One "YYYY-MM" sheet per distinct month, chronological ascending.
 *   3. "Summary" — monthly income/expense/net/count rollup.
 */
import type { Transaction } from './finance';
import { EXPORT_HEADERS, summarizeMonth, transactionsToRows } from './finance';

export const SHEET_ALL_TRANSACTIONS = 'All Transactions';
/** Legacy export sheet name; recognised on import only. */
export const SHEET_LEGACY_TRANSACTIONS = 'Transactions';
export const SHEET_SUMMARY = 'Summary';

/** Column widths for the transaction sheets, aligned with `EXPORT_HEADERS`. */
export const TRANSACTION_COL_WIDTHS = [24, 12, 9, 12, 9, 18, 18, 28, 22, 14, 8, 9, 22, 20];

export const SUMMARY_HEADERS = ['Month', 'Income', 'Expense', 'Net', 'Transaction Count'] as const;

export type MonthlySummaryRow = {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
};

/** Month key (`YYYY-MM`) a transaction belongs to, derived from its ISO date. */
export function transactionMonthKey(transaction: Transaction): string {
  return transaction.date.slice(0, 7);
}

/**
 * Group transactions by `YYYY-MM`, returning a Map ordered chronologically
 * ascending. All rows are kept (including soft-deleted) so the monthly sheets
 * are a faithful partition of the master sheet.
 */
export function groupTransactionsByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = transactionMonthKey(transaction);
    const bucket = map.get(key);
    if (bucket) bucket.push(transaction);
    else map.set(key, [transaction]);
  }

  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Per-month income/expense/net/count rollup for the Summary sheet. Uses
 * `summarizeMonth`, so only active (non-deleted) transactions are counted.
 */
export function buildMonthlySummary(transactions: Transaction[]): MonthlySummaryRow[] {
  const months = [...groupTransactionsByMonth(transactions).keys()];
  return months.map((month) => {
    const summary = summarizeMonth(transactions, month);
    return {
      month,
      income: summary.income,
      expense: summary.expense,
      net: summary.balance,
      count: summary.count
    };
  });
}

/** Header row + one array per month, for the Summary worksheet. */
export function buildSummaryRows(summary: MonthlySummaryRow[]): (string | number)[][] {
  return [
    [...SUMMARY_HEADERS],
    ...summary.map((row) => [row.month, row.income, row.expense, row.net, row.count])
  ];
}

export type WorkbookSheet = {
  name: string;
  rows: (string | number)[][];
};

export type WorkbookPayload = {
  sheets: WorkbookSheet[];
};

/**
 * Assemble the full workbook payload: master sheet first, then one sheet per
 * month, then the summary. Returns plain row data; the platform adapter turns
 * it into a real `.xlsx` file.
 */
export function buildTransactionsWorkbook(transactions: Transaction[]): WorkbookPayload {
  const byMonth = groupTransactionsByMonth(transactions);

  const sheets: WorkbookSheet[] = [
    { name: SHEET_ALL_TRANSACTIONS, rows: transactionsToRows(transactions) }
  ];

  for (const [month, monthTransactions] of byMonth) {
    sheets.push({ name: month, rows: transactionsToRows(monthTransactions) });
  }

  sheets.push({ name: SHEET_SUMMARY, rows: buildSummaryRows(buildMonthlySummary(transactions)) });

  return { sheets };
}

/** Column widths keyed by sheet name, for the platform adapter to apply. */
export function columnWidthsForSheet(sheetName: string): number[] | undefined {
  if (sheetName === SHEET_SUMMARY) return [10, 14, 14, 14, 18];
  // All Transactions + per-month sheets share the transaction column layout.
  return EXPORT_HEADERS.length === TRANSACTION_COL_WIDTHS.length ? TRANSACTION_COL_WIDTHS : undefined;
}
