import { describe, expect, it } from 'vitest';
import { deriveSyncPhase, type SyncPhaseInputs } from './syncState';

const base: SyncPhaseInputs = {
  preferredMode: 'turso',
  isOnline: true,
  effectiveMode: 'turso',
  activity: 'idle',
  hasConflict: false,
  comparison: 'up_to_date'
};

describe('deriveSyncPhase', () => {
  it('is local_only when Turso is not the preferred mode', () => {
    expect(deriveSyncPhase({ ...base, preferredMode: 'local' })).toBe('local_only');
  });

  it('is offline when there is no connectivity (overrides comparison)', () => {
    expect(deriveSyncPhase({ ...base, isOnline: false, comparison: 'cloud_newer' })).toBe('offline');
  });

  it('shows transient activity over steady state', () => {
    expect(deriveSyncPhase({ ...base, activity: 'syncing' })).toBe('syncing');
    expect(deriveSyncPhase({ ...base, activity: 'checking' })).toBe('checking');
  });

  it('flags conflict on a pending conflict or diverged comparison', () => {
    expect(deriveSyncPhase({ ...base, hasConflict: true })).toBe('conflict');
    expect(deriveSyncPhase({ ...base, comparison: 'diverged' })).toBe('conflict');
  });

  it('is not_synced when Turso is configured but running on the local cache', () => {
    expect(deriveSyncPhase({ ...base, effectiveMode: 'local' })).toBe('not_synced');
  });

  it('is not_synced when one side is ahead', () => {
    expect(deriveSyncPhase({ ...base, comparison: 'local_newer' })).toBe('not_synced');
    expect(deriveSyncPhase({ ...base, comparison: 'cloud_newer' })).toBe('not_synced');
  });

  it('is up_to_date when synced (or not yet checked)', () => {
    expect(deriveSyncPhase({ ...base, comparison: 'up_to_date' })).toBe('up_to_date');
    expect(deriveSyncPhase({ ...base, comparison: null })).toBe('up_to_date');
  });
});
