import { useLedger } from '../ledger';
import { SYNC_PHASE_META, type SyncPhase, type SyncPhaseMeta } from '../../../shared/sync/syncState';

export type UseSyncResult = {
  phase: SyncPhase;
  meta: SyncPhaseMeta;
  /** ISO timestamp of the last successful cloud sync, or null. */
  lastSynced: string | null;
  /** Manual Refresh (bypasses cooldown; routes conflicts to the dialog). */
  refresh: () => Promise<void>;
  /** Throttled automatic metadata check. */
  checkForUpdates: () => Promise<void>;
  isChecking: boolean;
  isSyncing: boolean;
  /** A network request is in flight; disable the Refresh control. */
  isBusy: boolean;
};

/**
 * Thin selector over the ledger context so components consume sync state and
 * actions without touching storage internals.
 */
export function useSync(): UseSyncResult {
  const { syncPhase, lastSyncedAt, refresh, checkForUpdates } = useLedger();
  const isChecking = syncPhase === 'checking';
  const isSyncing = syncPhase === 'syncing';
  return {
    phase: syncPhase,
    meta: SYNC_PHASE_META[syncPhase],
    lastSynced: lastSyncedAt,
    refresh,
    checkForUpdates,
    isChecking,
    isSyncing,
    isBusy: isChecking || isSyncing
  };
}
