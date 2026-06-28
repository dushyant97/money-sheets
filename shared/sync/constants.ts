/**
 * Synchronization tuning constants. The sync model is deliberately NOT
 * real-time: lightweight metadata checks run only on natural user interactions
 * (navigation, focus, visibility) and are throttled by a cooldown.
 */

/**
 * Minimum gap between automatic sync checks. Manual Refresh bypasses this.
 * Configurable: bump it to reduce network chatter on slow/metered connections.
 */
export const SYNC_COOLDOWN_MS = 30_000;

/**
 * A revision token is the `ledger_updated_at` ISO timestamp stored in the
 * Turso `settings` table (and mirrored on the local snapshot's `updatedAt`).
 * Comparing tokens lets us detect newer cloud data without downloading the
 * whole ledger.
 */
export type Revision = string | null;
