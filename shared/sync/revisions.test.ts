import { describe, expect, it } from 'vitest';
import { compareRevisions } from './revisions';

const A = '2026-06-28T10:00:00.000Z';
const B = '2026-06-28T11:00:00.000Z';

describe('compareRevisions', () => {
  it('treats equal tokens (including both null) as up to date', () => {
    expect(compareRevisions(A, A, A)).toBe('up_to_date');
    expect(compareRevisions(null, null, null)).toBe('up_to_date');
  });

  describe('with a baseline', () => {
    it('detects cloud-only change as cloud_newer', () => {
      // baseline = A, local stayed at A, cloud moved to B
      expect(compareRevisions(A, B, A)).toBe('cloud_newer');
    });

    it('detects local-only change as local_newer', () => {
      // baseline = A, cloud stayed at A, local moved to B
      expect(compareRevisions(B, A, A)).toBe('local_newer');
    });

    it('detects two-sided change as diverged', () => {
      // baseline = A, both moved away from A to different values
      expect(compareRevisions(B, '2026-06-28T12:00:00.000Z', A)).toBe('diverged');
    });
  });

  describe('without a baseline', () => {
    it('orders by timestamp', () => {
      expect(compareRevisions(A, B, null)).toBe('cloud_newer');
      expect(compareRevisions(B, A, null)).toBe('local_newer');
    });

    it('treats a present revision as newer than a missing one', () => {
      expect(compareRevisions(null, A, null)).toBe('cloud_newer');
      expect(compareRevisions(A, null, null)).toBe('local_newer');
    });
  });
});
