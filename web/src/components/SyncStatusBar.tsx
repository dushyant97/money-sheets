import { useEffect, useState } from 'react';
import { useSync } from '../sync/useSync';
import { formatRelativeTime } from '../utils/time';

const TONE_BY_PHASE: Record<string, string> = {
  up_to_date: 'online',
  not_synced: 'warn',
  conflict: 'warn',
  offline: 'offline',
  checking: '',
  syncing: '',
  local_only: ''
};

/**
 * Rich Turso sync status (icon + label + "Last synced X ago") with a manual
 * Refresh control. Rendered in the top bar (compact, all viewports — so mobile
 * gets a Refresh button) and the desktop sidebar (full).
 */
export function SyncStatusBar({ compact = false }: { compact?: boolean }) {
  const { phase, meta, lastSynced, refresh, isBusy } = useSync();

  // Re-render every 30s so the relative "Last synced" copy stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'up_to_date' || !lastSynced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [phase, lastSynced]);

  if (phase === 'local_only') {
    if (!compact) {
      return (
        <div className="offline-pill">
          <span className="offline-dot" />
          Local only · saved on this device
        </div>
      );
    }
    return (
      <div
        className="offline-pill sync-status-bar compact"
        title="Switch to Turso DB under More → Storage to sync to the cloud"
      >
        <span className="offline-dot" />
        <span className="sync-status-label">Local</span>
      </div>
    );
  }

  const tone = TONE_BY_PHASE[phase] ?? '';
  const relative = phase === 'up_to_date' ? formatRelativeTime(lastSynced) : null;
  const subtitle = relative ? `Last synced ${relative}` : meta.description;
  const refreshTitle = phase === 'conflict' ? 'Resolve sync conflict' : 'Check for cloud updates';

  return (
    <div
      className={`offline-pill sync-status-bar ${tone} ${compact ? 'compact' : ''}`}
      data-phase={phase}
      title={compact ? `${meta.label} · ${subtitle}` : meta.label}
    >
      <span className="sync-status-icon" aria-hidden>
        {meta.icon}
      </span>
      <span className="sync-status-text">
        <span className="sync-status-label">{compact ? meta.shortLabel : meta.label}</span>
        {!compact && subtitle ? <span className="sync-status-sub">{subtitle}</span> : null}
      </span>
      {compact ? (
        <button
          type="button"
          className={`ghost sm sync-refresh-btn ${isBusy ? 'is-busy' : ''}`}
          disabled={isBusy}
          title={refreshTitle}
          aria-label={refreshTitle}
          onClick={() => void refresh()}
        >
          <span className="sync-refresh-icon" aria-hidden>
            ⟳
          </span>
        </button>
      ) : null}
    </div>
  );
}
