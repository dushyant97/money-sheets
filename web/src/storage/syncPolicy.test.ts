import { describe, expect, it } from 'vitest';
import type { EffectiveStorageInfo } from '../../../shared/storage/types';
import { computeSyncStatus, canShowSyncNow, resolveSyncCase } from './syncPolicy';

describe('resolveSyncCase', () => {
  it('Case 2: not connected → offline regardless of data', () => {
    expect(resolveSyncCase({ connected: false, localEmpty: true, tursoEmpty: true })).toBe('offline');
    expect(resolveSyncCase({ connected: false, localEmpty: false, tursoEmpty: false })).toBe('offline');
  });

  it('Case 1: both empty + connected → fresh', () => {
    expect(resolveSyncCase({ connected: true, localEmpty: true, tursoEmpty: true })).toBe('fresh');
  });

  it('Case 3: local empty, turso has data → pull', () => {
    expect(resolveSyncCase({ connected: true, localEmpty: true, tursoEmpty: false })).toBe('pull');
  });

  it('Case 4: both have data → conflict', () => {
    expect(resolveSyncCase({ connected: true, localEmpty: false, tursoEmpty: false })).toBe('conflict');
  });

  it('local has data, turso empty → push_local', () => {
    expect(resolveSyncCase({ connected: true, localEmpty: false, tursoEmpty: true })).toBe('push_local');
  });
});

describe('computeSyncStatus', () => {
  const turso = (over: Partial<EffectiveStorageInfo> = {}): EffectiveStorageInfo => ({
    preferredMode: 'turso',
    effectiveMode: 'turso',
    isTursoFallback: false,
    isOnline: true,
    ...over
  });

  it('local mode → local', () => {
    expect(computeSyncStatus(turso({ preferredMode: 'local', effectiveMode: 'local' }), 'a', 'a')).toBe('local');
  });

  it('turso fallback while online → not_synced', () => {
    expect(computeSyncStatus(turso({ effectiveMode: 'local', isTursoFallback: true }), 'a', null)).toBe(
      'not_synced'
    );
  });

  it('browser offline with turso preferred → offline', () => {
    expect(computeSyncStatus(turso({ isOnline: false, effectiveMode: 'local' }), 'a', null)).toBe('offline');
  });

  it('matching timestamps → synced', () => {
    expect(computeSyncStatus(turso(), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')).toBe('synced');
  });

  it('diverging timestamps → not_synced', () => {
    expect(computeSyncStatus(turso(), '2025-01-02T00:00:00Z', '2025-01-01T00:00:00Z')).toBe('not_synced');
  });

  it('missing turso timestamp → not_synced', () => {
    expect(computeSyncStatus(turso(), '2025-01-02T00:00:00Z', null)).toBe('not_synced');
  });
});

describe('canShowSyncNow', () => {
  const turso = (over: Partial<EffectiveStorageInfo> = {}): EffectiveStorageInfo => ({
    preferredMode: 'turso',
    effectiveMode: 'turso',
    isTursoFallback: false,
    isOnline: true,
    ...over
  });

  it('shows when online, turso preferred, and not synced', () => {
    expect(canShowSyncNow(turso(), 'not_synced')).toBe(true);
  });

  it('hides when synced or local-only mode', () => {
    expect(canShowSyncNow(turso(), 'synced')).toBe(false);
    expect(canShowSyncNow(turso({ preferredMode: 'local', effectiveMode: 'local' }), 'not_synced')).toBe(false);
  });
});
