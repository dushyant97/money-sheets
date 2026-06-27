/**
 * Normalized Turso repository: assembles a `LedgerSnapshot` for the UI from the
 * normalized tables, applies granular per-mutation writes, and bulk-writes a
 * full snapshot for seeding/import.
 *
 * Operates on a `SqlClient`; the platform adapter owns the client lifecycle.
 */
import type { Account, Budget, Category, Transaction } from '../finance';
import {
  LEDGER_STORAGE_VERSION,
  createDefaultLedger,
  type LedgerSettings,
  type LedgerSnapshot
} from '../ledgerStore';
import type { SqlClient, SqlStatement } from './sqlClient';
import { loadTransactions, insertTransaction, updateTransaction, softDeleteTransaction } from './transactions';
import { loadAccounts, saveAccount, removeAccount, upsertAccountStatement } from './accounts';
import { loadCategories, saveCategory, removeCategory, upsertCategoryStatement } from './categories';
import { loadBudgets, upsertBudget } from './budgets';
import { loadSettings, saveSettings, getLedgerUpdatedAt, ledgerUpdatedAtStatement } from './settings';
import { writeSnapshot } from './snapshotWrite';

export { getLedgerUpdatedAt } from './settings';

/**
 * Assemble the full ledger from the normalized tables. Runs the per-table
 * reads in parallel. An empty database returns the default ledger so the UI
 * always has baseline accounts/categories (mirrors `parseStoredLedger(null)`).
 */
export async function loadSnapshot(client: SqlClient): Promise<LedgerSnapshot> {
  const [transactions, accounts, categories, budgets, settings, updatedAt] = await Promise.all([
    loadTransactions(client),
    loadAccounts(client),
    loadCategories(client),
    loadBudgets(client),
    loadSettings(client),
    getLedgerUpdatedAt(client)
  ]);

  if (transactions.length === 0 && accounts.length === 0 && categories.length === 0 && budgets.length === 0) {
    return createDefaultLedger();
  }

  const defaults = createDefaultLedger();
  return {
    version: LEDGER_STORAGE_VERSION,
    updatedAt: updatedAt ?? new Date().toISOString(),
    transactions,
    accounts: accounts.length ? accounts : defaults.accounts,
    categories: categories.length ? categories : defaults.categories,
    budgets,
    settings
  };
}

/** Overwrite the entire normalized store with a snapshot (seed/import/switch). */
export async function saveSnapshot(client: SqlClient, snapshot: LedgerSnapshot): Promise<void> {
  await writeSnapshot(client, snapshot, { replace: true });
}

export async function touchLedger(client: SqlClient, updatedAt: string): Promise<void> {
  await client.execute(ledgerUpdatedAtStatement(updatedAt));
}

// ── rename helpers (propagate the new name across referencing rows) ──────────
async function renameAccount(client: SqlClient, from: string, account: Account): Promise<void> {
  if (account.name === from) {
    await saveAccount(client, account);
    return;
  }
  const statements: SqlStatement[] = [
    upsertAccountStatement(account),
    { sql: 'UPDATE transactions SET account = ? WHERE account = ?;', args: [account.name, from] },
    { sql: 'DELETE FROM accounts WHERE name = ?;', args: [from] }
  ];
  await client.batch(statements, 'write');
}

async function renameCategory(client: SqlClient, from: string, category: Category): Promise<void> {
  if (category.name === from) {
    await saveCategory(client, category);
    return;
  }
  const statements: SqlStatement[] = [
    upsertCategoryStatement(category),
    { sql: 'UPDATE transactions SET category = ? WHERE category = ?;', args: [category.name, from] },
    { sql: 'UPDATE budgets SET category = ? WHERE category = ?;', args: [category.name, from] },
    { sql: 'DELETE FROM categories WHERE name = ?;', args: [from] }
  ];
  await client.batch(statements, 'write');
}

/**
 * A single granular ledger mutation, mirroring the `ledgerStore` operations.
 * `replaceAll` is used for import/reset/showcase where a full rewrite is
 * appropriate.
 */
export type LedgerChange =
  | { kind: 'insertTransaction'; transaction: Transaction }
  | { kind: 'updateTransaction'; transaction: Transaction }
  | { kind: 'deleteTransaction'; id: string }
  | { kind: 'saveAccount'; account: Account }
  | { kind: 'removeAccount'; name: string }
  | { kind: 'renameAccount'; from: string; account: Account }
  | { kind: 'saveCategory'; category: Category }
  | { kind: 'removeCategory'; name: string }
  | { kind: 'renameCategory'; from: string; category: Category }
  | { kind: 'upsertBudget'; budget: Budget }
  | { kind: 'setSettings'; settings: LedgerSettings }
  | { kind: 'replaceAll' };

/**
 * Apply one change to the normalized store, then bump `ledger_updated_at`.
 * Without a change descriptor (or for `replaceAll`), the whole snapshot is
 * rewritten — used by import, reset and showcase mode.
 */
export async function applyChange(
  client: SqlClient,
  snapshot: LedgerSnapshot,
  change?: LedgerChange
): Promise<void> {
  switch (change?.kind) {
    case 'insertTransaction':
      await insertTransaction(client, change.transaction);
      break;
    case 'updateTransaction':
      await updateTransaction(client, change.transaction);
      break;
    case 'deleteTransaction':
      await softDeleteTransaction(client, change.id);
      break;
    case 'saveAccount':
      await saveAccount(client, change.account);
      break;
    case 'removeAccount':
      await removeAccount(client, change.name);
      break;
    case 'renameAccount':
      await renameAccount(client, change.from, change.account);
      break;
    case 'saveCategory':
      await saveCategory(client, change.category);
      break;
    case 'removeCategory':
      await removeCategory(client, change.name);
      break;
    case 'renameCategory':
      await renameCategory(client, change.from, change.category);
      break;
    case 'upsertBudget':
      await upsertBudget(client, change.budget);
      break;
    case 'setSettings':
      await saveSettings(client, change.settings);
      break;
    default:
      // replaceAll or unknown: full rewrite from the assembled snapshot.
      await saveSnapshot(client, snapshot);
      return;
  }
  await touchLedger(client, snapshot.updatedAt);
}
