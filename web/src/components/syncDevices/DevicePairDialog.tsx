import { QrGenerator } from './QrGenerator';
import { ScanFlow } from './ScanFlow';
import type { TursoConfig } from '../../../../shared/storage/types';

export type PairDialogMode = 'generate' | 'scan';

export type ScanHandlers = {
  testConnection: (credentials: TursoConfig) => Promise<void>;
  applyCredentials: (credentials: TursoConfig) => Promise<void>;
  busy: boolean;
};

/**
 * Modal shell for the device-pairing flow. Hosts either the QR generator
 * (this device shares its credentials) or the scanner (this device joins).
 */
export function DevicePairDialog({
  mode,
  credentials,
  deviceName,
  scan,
  onClose
}: {
  mode: PairDialogMode;
  credentials: TursoConfig;
  deviceName: string;
  scan?: ScanHandlers;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pair-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pair-dialog-head">
          <h3>{mode === 'generate' ? 'Pair another device' : 'Scan pairing code'}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {mode === 'generate' ? (
          <QrGenerator credentials={credentials} deviceName={deviceName} />
        ) : scan ? (
          <ScanFlow
            testConnection={scan.testConnection}
            applyCredentials={scan.applyCredentials}
            busy={scan.busy}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
