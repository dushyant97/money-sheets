import { Suspense, lazy, useMemo, useState } from 'react';
import { useLedger } from '../../ledger';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { detectDeviceName } from '../../utils/deviceName';
import { formatRelativeTime } from '../../utils/time';
import { dbNameFromUrl } from '../../../../shared/pairing/payload';
import type { TursoConfig } from '../../../../shared/storage/types';
import { AdvancedSyncFields } from './AdvancedSyncFields';
import type { PairDialogMode } from './DevicePairDialog';

// The QR generator and camera scanner pull in sizeable libraries; load them
// only when the user actually opens the pairing dialog.
const DevicePairDialog = lazy(() =>
  import('./DevicePairDialog').then((m) => ({ default: m.DevicePairDialog }))
);

/**
 * "Sync Other Devices" — a pairing-first front door for cloud sync. The default
 * experience hides Turso terminology: the user generates a QR on a connected
 * device and scans it on a new one. Manual credentials live under Advanced.
 */
export function SyncOtherDevicesPanel() {
  const { storagePrefs, effectiveStorage, testTursoConnection, joinTursoDevice, busy, showcaseMode, lastUpdatedAt } =
    useLedger();
  const isMobile = useIsMobile();
  const deviceName = useMemo(() => detectDeviceName(), []);

  const [dialog, setDialog] = useState<PairDialogMode | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const tursoActive = effectiveStorage.effectiveMode === 'turso';
  const canGenerate = tursoActive && !showcaseMode;

  async function applyCredentials(credentials: TursoConfig) {
    // Adopt the shared database without pushing this device's (possibly empty)
    // cache over it. Reloads; boot reconciliation pulls the remote data, or
    // shows the conflict dialog if this device already had its own data.
    await joinTursoDevice(credentials);
  }

  const status = tursoActive
    ? {
        tone: 'ok' as const,
        dot: 'online',
        title: 'Connected',
        detail: `Database ${dbNameFromUrl(storagePrefs.turso.url)}`
      }
    : effectiveStorage.isTursoFallback
      ? {
          tone: 'warn' as const,
          dot: 'warn',
          title: 'Cloud sync offline',
          detail: 'Using the local copy on this device until you reconnect'
        }
      : {
          tone: '' as const,
          dot: '',
          title: 'Not syncing',
          detail: 'This device keeps your data locally only'
        };

  const lastSynced = formatRelativeTime(lastUpdatedAt);

  return (
    <div className="panel sync-devices-panel">
      <div className="panel-head">
        <h3>Sync Other Devices</h3>
      </div>

      <div className={`sync-device-status ${status.tone}`}>
        <span className={`sync-device-dot ${status.dot}`} />
        <div className="sync-device-status-body">
          <strong>{status.title}</strong>
          <span className="muted">{status.detail}</span>
          {tursoActive && lastSynced ? (
            <span className="muted">Last synced {lastSynced}</span>
          ) : null}
        </div>
      </div>

      <div className="sync-device-actions">
        <p className="muted sync-device-lead">
          Show a one-time QR code so your other phone or laptop can join the same sync — no typing
          required.
        </p>
        <div className="sync-device-buttons">
          <button
            type="button"
            className="primary"
            disabled={!canGenerate}
            title={
              canGenerate
                ? undefined
                : showcaseMode
                  ? 'Exit showcase mode to pair a device.'
                  : 'Turn on cloud sync first (Storage → Turso DB) to pair another device.'
            }
            onClick={() => setDialog('generate')}
          >
            Generate pairing QR
          </button>
          {isMobile ? (
            <button
              type="button"
              className="ghost"
              disabled={showcaseMode}
              title={showcaseMode ? 'Exit showcase mode to pair a device.' : undefined}
              onClick={() => setDialog('scan')}
            >
              Scan QR
            </button>
          ) : null}
        </div>
        {!canGenerate && !showcaseMode ? (
          <p className="storage-hint muted">
            Turn on cloud sync under <strong>Storage</strong> first. Then you can pair another device,
            {isMobile ? ' or scan a QR shown on a device that is already connected.' : ' or join from another device by scanning its QR.'}
          </p>
        ) : null}
      </div>

      <details
        className="sync-advanced"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>Advanced</summary>
        <p className="storage-hint muted">
          Prefer to type credentials yourself? Paste your Turso database URL and auth token.
        </p>
        <AdvancedSyncFields
          initial={storagePrefs.turso}
          onTest={testTursoConnection}
          onApply={applyCredentials}
          busy={busy}
        />
      </details>

      {dialog ? (
        <Suspense
          fallback={
            <div className="modal-backdrop">
              <div className="modal pair-dialog">
                <p className="muted">Loading…</p>
              </div>
            </div>
          }
        >
          <DevicePairDialog
            mode={dialog}
            credentials={storagePrefs.turso}
            deviceName={deviceName}
            scan={
              dialog === 'scan'
                ? { testConnection: testTursoConnection, applyCredentials, busy }
                : undefined
            }
            onClose={() => setDialog(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
