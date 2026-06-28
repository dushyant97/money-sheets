import type { Revision } from '../../../shared/sync/constants';

/**
 * The cloud revision (`ledger_updated_at`) observed at the last successful
 * sync. Persisted so a fresh page load can still tell a one-sided change from a
 * true two-sided divergence (see compareRevisions).
 */
const LAST_SYNCED_REVISION_KEY = 'money-sheets:last-synced-revision';

export function loadLastSyncedRevision(): Revision {
  try {
    return localStorage.getItem(LAST_SYNCED_REVISION_KEY);
  } catch {
    return null;
  }
}

export function saveLastSyncedRevision(revision: Revision): void {
  try {
    if (revision === null) localStorage.removeItem(LAST_SYNCED_REVISION_KEY);
    else localStorage.setItem(LAST_SYNCED_REVISION_KEY, revision);
  } catch {
    // Best-effort: a missing baseline only degrades to timestamp ordering.
  }
}
