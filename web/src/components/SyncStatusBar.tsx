import { useLedger, SYNC_STATUS_LABEL } from '../ledger';
import { canShowSyncNow } from '../storage/syncPolicy';

/**
 * Turso sync status + optional "Sync now" action. Rendered in the top bar (all
 * viewports) and the desktop sidebar so mobile users are not blind to sync state.
 */
export function SyncStatusBar({ compact = false }: { compact?: boolean }) {
  const { effectiveStorage, syncStatus, syncNow, busy } = useLedger();

  if (effectiveStorage.preferredMode !== 'turso') {
    if (!compact) {
      return (
        <div className="offline-pill">
          <span className="offline-dot" />
          Local only · saved on this device
        </div>
      );
    }
    return (
      <div className="offline-pill sync-status-bar compact" title="Switch to Turso DB under More → Storage to sync to the cloud">
        <span className="offline-dot" />
        <span className="sync-status-label">Local only</span>
      </div>
    );
  }

  const label = SYNC_STATUS_LABEL[syncStatus];
  const tone = syncStatus === 'synced' ? 'online' : syncStatus === 'not_synced' ? 'warn' : '';
  const showSync = canShowSyncNow(effectiveStorage, syncStatus);

  return (
    <div className={`offline-pill sync-status-bar ${tone} ${compact ? 'compact' : ''}`}>
      <span className="offline-dot" />
      <span className="sync-status-label">{label}</span>
      {showSync ? (
        <button
          type="button"
          className="ghost sm sync-now-btn"
          disabled={busy}
          onClick={() => void syncNow()}
        >
          Sync now
        </button>
      ) : null}
    </div>
  );
}
