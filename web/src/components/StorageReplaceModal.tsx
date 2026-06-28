import type { StorageMode } from '../../../shared/storage/types';

/**
 * Confirmation shown when switching storage mode would overwrite existing data
 * in the destination store. Used by both the Storage panel and device pairing.
 */
export function StorageReplaceModal({
  targetMode,
  onConfirm,
  onCancel
}: {
  targetMode: StorageMode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const targetLabel = targetMode === 'turso' ? 'Turso DB' : 'Local Storage';
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon warn">⚠️</div>
        <h3 style={{ margin: 0 }}>Replace data in {targetLabel}?</h3>
        <p className="muted confirm-text">
          {targetLabel} already has saved records. Continuing overwrites them with the data from your current
          store. This cannot be undone — export a backup first if you need it.
        </p>
        <div className="confirm-actions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={onConfirm}>Replace &amp; continue</button>
        </div>
      </div>
    </div>
  );
}
