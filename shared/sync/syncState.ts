import type { RevisionComparison } from './revisions';

/**
 * User-facing sync phase. Supersedes the older 4-value SyncStatus for display.
 * Ordering of resolution is by urgency: connectivity first, then transient
 * activity, then the data relationship.
 */
export type SyncPhase =
  | 'local_only'
  | 'offline'
  | 'checking'
  | 'syncing'
  | 'up_to_date'
  | 'not_synced'
  | 'conflict';

/** Transient work the sync manager is doing right now. */
export type SyncActivity = 'idle' | 'checking' | 'syncing';

export type SyncPhaseInputs = {
  /** What the user selected (local vs turso). */
  preferredMode: 'local' | 'turso';
  /** Browser connectivity. */
  isOnline: boolean;
  /** What is actually being read/written right now. */
  effectiveMode: 'local' | 'turso';
  /** Transient activity overrides the steady-state phase. */
  activity: SyncActivity;
  /** A pending two-sided conflict awaiting user choice. */
  hasConflict: boolean;
  /** Last known relationship between local and cloud (null until first check). */
  comparison: RevisionComparison | null;
};

/**
 * Pure mapping from sync inputs to a display phase. Side-effect free for easy
 * testing; the provider feeds it live state.
 */
export function deriveSyncPhase(input: SyncPhaseInputs): SyncPhase {
  if (input.preferredMode !== 'turso') return 'local_only';
  if (!input.isOnline) return 'offline';
  if (input.activity === 'syncing') return 'syncing';
  if (input.activity === 'checking') return 'checking';
  if (input.hasConflict || input.comparison === 'diverged') return 'conflict';
  // Turso is configured but we are operating on the local cache (unreachable at
  // boot, or offline edits not yet pushed).
  if (input.effectiveMode !== 'turso') return 'not_synced';
  if (input.comparison === 'local_newer' || input.comparison === 'cloud_newer') return 'not_synced';
  return 'up_to_date';
}

export type SyncPhaseMeta = {
  icon: string;
  label: string;
  /** Short label for the compact mobile pill. */
  shortLabel: string;
  description: string;
};

export const SYNC_PHASE_META: Record<SyncPhase, SyncPhaseMeta> = {
  local_only: {
    icon: '⚪',
    label: 'Local only',
    shortLabel: 'Local',
    description: 'Saved on this device only'
  },
  offline: {
    icon: '🔴',
    label: 'Offline',
    shortLabel: 'Offline',
    description: 'Using local data until you reconnect'
  },
  checking: {
    icon: '🟡',
    label: 'Checking…',
    shortLabel: 'Checking',
    description: 'Looking for cloud updates'
  },
  syncing: {
    icon: '🔵',
    label: 'Syncing…',
    shortLabel: 'Syncing',
    description: 'Updating data with the cloud'
  },
  up_to_date: {
    icon: '🟢',
    label: 'Up to date',
    shortLabel: 'Synced',
    description: 'In sync with the cloud'
  },
  not_synced: {
    icon: '🟡',
    label: 'Not synced',
    shortLabel: 'Not synced',
    description: 'This device has changes to push'
  },
  conflict: {
    icon: '⚠️',
    label: 'Conflict detected',
    shortLabel: 'Conflict',
    description: 'Both devices changed — choose which to keep'
  }
};
