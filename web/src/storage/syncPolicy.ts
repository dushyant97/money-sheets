/**
 * Pure decision logic for the four Turso connection cases and the header sync
 * status. Kept side-effect free so it is easy to unit test; the orchestration
 * (loading, dialogs, writes) lives in the LedgerProvider.
 *
 * Cases (see the design plan):
 *   1. local empty, turso empty, connected  → 'fresh'      start writing to Turso
 *   2. not connected                         → 'offline'    operate on local cache
 *   3. local empty, turso has data           → 'pull'       load Turso into UI + cache
 *   4. local has data, turso has data        → 'conflict'   ask the user which wins
 *      (local has data, turso empty          → 'push_local' push local up silently)
 */
import type { EffectiveStorageInfo } from '../../../shared/storage/types';

export type SyncCase = 'fresh' | 'offline' | 'pull' | 'push_local' | 'conflict';

export type SyncCaseInputs = {
  /** Turso preferred, configured, online and effective. */
  connected: boolean;
  /** Local cache has no active transactions. */
  localEmpty: boolean;
  /** Turso has no active transactions. */
  tursoEmpty: boolean;
};

export function resolveSyncCase(inputs: SyncCaseInputs): SyncCase {
  if (!inputs.connected) return 'offline';
  if (inputs.localEmpty) {
    return inputs.tursoEmpty ? 'fresh' : 'pull';
  }
  return inputs.tursoEmpty ? 'push_local' : 'conflict';
}

/** Header sync status shown to the user. */
export type SyncStatus = 'local' | 'offline' | 'synced' | 'not_synced';

export function computeSyncStatus(
  effective: EffectiveStorageInfo,
  localUpdatedAt: string | null,
  tursoUpdatedAt: string | null
): SyncStatus {
  if (effective.preferredMode !== 'turso') return 'local';
  if (!effective.isOnline) return 'offline';
  // Turso is configured but the app is on the local cache (offline edits, or
  // Turso was unreachable at boot). Local changes are not on Turso yet.
  if (effective.effectiveMode !== 'turso') return 'not_synced';
  if (localUpdatedAt && tursoUpdatedAt && localUpdatedAt === tursoUpdatedAt) return 'synced';
  return 'not_synced';
}

/** True when the user can tap "Sync now" to reconcile with Turso. */
export function canShowSyncNow(effective: EffectiveStorageInfo, syncStatus: SyncStatus): boolean {
  return effective.preferredMode === 'turso' && effective.isOnline && syncStatus === 'not_synced';
}

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  local: 'Local only',
  offline: 'Offline · local copy',
  synced: 'Synced with Turso',
  not_synced: 'Not synced with Turso'
};

/** Shorter labels for the compact pill in the mobile top bar. */
export const SYNC_STATUS_SHORT: Record<SyncStatus, string> = {
  local: 'Local',
  offline: 'Offline',
  synced: 'Synced',
  not_synced: 'Not synced'
};
