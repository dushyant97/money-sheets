import { SYNC_COOLDOWN_MS } from './constants';

/**
 * Throttle gate for automatic sync checks. Returns true when enough time has
 * passed since the last check. `lastCheckAt` of null means "never checked".
 */
export function shouldCheck(
  lastCheckAt: number | null,
  now: number = Date.now(),
  cooldownMs: number = SYNC_COOLDOWN_MS
): boolean {
  if (lastCheckAt === null) return true;
  return now - lastCheckAt >= cooldownMs;
}

/** Milliseconds remaining before the next automatic check is allowed (0 if now). */
export function cooldownRemaining(
  lastCheckAt: number | null,
  now: number = Date.now(),
  cooldownMs: number = SYNC_COOLDOWN_MS
): number {
  if (lastCheckAt === null) return 0;
  return Math.max(0, cooldownMs - (now - lastCheckAt));
}
