import type { LedgerSnapshot } from '../../../shared/ledgerStore';
import type { StorageMode, StoragePreferences } from '../../../shared/storage/types';
import { isTursoConfigComplete } from '../../../shared/storage/prefs';
import { localAdapter, localLedgerExists } from './localAdapter';
import { createTursoAdapter, loadTursoLedger } from './tursoAdapter';
import { resolveEffectiveStorage } from './activeStorage';

/** Does the given mode already hold a usable ledger with real data? */
async function targetHasData(mode: StorageMode, prefs: StoragePreferences): Promise<boolean> {
  if (mode === 'local') {
    if (!localLedgerExists()) return false;
    const snapshot = await localAdapter.load();
    return snapshot.transactions.length > 0;
  }
  // Turso
  if (!isTursoConfigComplete(prefs.turso)) return false;
  const snapshot = await loadTursoLedger(prefs.turso);
  return snapshot.transactions.length > 0;
}

export type ApplyStorageResult = {
  /** The snapshot now living in the newly selected store. */
  snapshot: LedgerSnapshot;
  /** Whether the target store was overwritten with current data. */
  replacedTarget: boolean;
};

export type ApplyStorageOptions = {
  current: StoragePreferences;
  next: StoragePreferences;
  /**
   * Called when the target store already has data and would be replaced.
   * Return true to proceed (overwrite), false to abort the switch.
   */
  confirmReplace: (targetMode: StorageMode) => Promise<boolean> | boolean;
};

/**
 * Move the active ledger from the current store to the newly selected store.
 *
 * When the target already contains data, `confirmReplace` is consulted before
 * overwriting. The current (source) snapshot always wins on confirm, matching
 * the plan's "replace with confirmation" behavior.
 */
export async function applyStorageSwitch(options: ApplyStorageOptions): Promise<ApplyStorageResult | null> {
  const { current, next, confirmReplace } = options;

  // Read the snapshot from whatever store is effective under current prefs.
  const currentInfo = resolveEffectiveStorage(current);
  const sourceAdapter =
    currentInfo.effectiveMode === 'turso' ? createTursoAdapter(current.turso) : localAdapter;
  const sourceSnapshot = await sourceAdapter.load();

  const targetMode = next.mode;
  const targetAdapter = targetMode === 'turso' ? createTursoAdapter(next.turso) : localAdapter;

  // If switching to a store that already has data, confirm before replacing.
  if (await targetHasData(targetMode, next)) {
    const proceed = await confirmReplace(targetMode);
    if (!proceed) return null;
  }

  await targetAdapter.save(sourceSnapshot);
  return { snapshot: sourceSnapshot, replacedTarget: true };
}
