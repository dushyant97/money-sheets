import type { Revision } from './constants';

/**
 * Result of comparing the local revision against the cloud revision.
 *  - up_to_date: both sides match; nothing to do.
 *  - cloud_newer: only the cloud changed since the last sync; safe to pull.
 *  - local_newer: only this device changed (e.g. offline edits); needs a push.
 *  - diverged: both changed since the last common sync; a true conflict.
 */
export type RevisionComparison = 'up_to_date' | 'cloud_newer' | 'local_newer' | 'diverged';

/**
 * Classify the relationship between local and cloud revisions.
 *
 * The `baseline` is the cloud revision observed at the last successful sync
 * (pull/push/conflict-resolve). With it we can tell a genuine two-sided
 * divergence from a simple one-sided change. Without it we fall back to plain
 * timestamp ordering, which can only guess at "newer".
 */
export function compareRevisions(
  localRev: Revision,
  cloudRev: Revision,
  baseline: Revision
): RevisionComparison {
  // Identical tokens (including both null) mean the two stores agree.
  if (localRev === cloudRev) return 'up_to_date';

  if (baseline !== undefined && baseline !== null) {
    const cloudChanged = cloudRev !== baseline;
    const localChanged = localRev !== baseline;
    if (cloudChanged && localChanged) return 'diverged';
    if (cloudChanged) return 'cloud_newer';
    return 'local_newer';
  }

  // No baseline yet: order by timestamp. A present revision always beats a
  // missing one on its own side.
  if (!cloudRev) return 'local_newer';
  if (!localRev) return 'cloud_newer';
  return cloudRev > localRev ? 'cloud_newer' : 'local_newer';
}
