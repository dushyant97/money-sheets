import { describe, expect, it } from 'vitest';
import { cooldownRemaining, shouldCheck } from './cooldown';

describe('shouldCheck', () => {
  it('always allows the first check', () => {
    expect(shouldCheck(null, 1_000_000, 30_000)).toBe(true);
  });

  it('skips while inside the cooldown window', () => {
    expect(shouldCheck(1_000_000, 1_010_000, 30_000)).toBe(false);
  });

  it('allows once the cooldown has elapsed (inclusive boundary)', () => {
    expect(shouldCheck(1_000_000, 1_030_000, 30_000)).toBe(true);
    expect(shouldCheck(1_000_000, 1_029_999, 30_000)).toBe(false);
  });
});

describe('cooldownRemaining', () => {
  it('is zero when never checked', () => {
    expect(cooldownRemaining(null, 1_000_000, 30_000)).toBe(0);
  });

  it('reports the remaining window', () => {
    expect(cooldownRemaining(1_000_000, 1_010_000, 30_000)).toBe(20_000);
    expect(cooldownRemaining(1_000_000, 1_050_000, 30_000)).toBe(0);
  });
});
