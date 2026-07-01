import { useState } from 'react';
import { EXPORT_FILENAME, canPickSaveLocation, type ExportDestination } from '../spreadsheet';
import { useEscToClose } from '../hooks/useEscToClose';

/**
 * Asks the user where to write the exported workbook:
 *  - Default download to the Downloads folder (works in every browser).
 *  - A specific file via the File System Access save picker (Chrome/Edge),
 *    which lets the user replace an existing file in place.
 *
 * The picker option is hidden when the browser lacks `showSaveFilePicker`
 * (Safari/Firefox), where only the default download is offered.
 */
export function ExportOptionsModal({
  onChoose,
  onCancel
}: {
  onChoose: (destination: ExportDestination) => void;
  onCancel: () => void;
}) {
  const supportsPicker = canPickSaveLocation();
  const [error, setError] = useState<string | null>(null);
  useEscToClose(onCancel);

  async function chooseLocation() {
    setError(null);
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName: EXPORT_FILENAME,
        types: [
          {
            description: 'Excel workbook',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
            }
          }
        ]
      });
      onChoose({ mode: 'picker', handle });
    } catch (err) {
      // The user dismissing the picker throws AbortError — treat as a no-op.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not open the file picker.');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal export-options-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export Excel</h2>
        <p className="muted">Choose where to save your workbook.</p>

        <div className="export-options">
          <button className="action-card" onClick={() => onChoose({ mode: 'default' })}>
            <span className="ac-ico">⬇️</span>
            <strong>Download to default location</strong>
            <span className="muted">Saves {EXPORT_FILENAME} to your Downloads folder.</span>
          </button>

          {supportsPicker ? (
            <button className="action-card" onClick={() => void chooseLocation()}>
              <span className="ac-ico">📁</span>
              <strong>Choose a location…</strong>
              <span className="muted">Pick a file to create or replace on your device.</span>
            </button>
          ) : (
            <p className="muted export-options-note">
              Choosing a specific location isn't supported in this browser. Use the default
              download instead.
            </p>
          )}
        </div>

        {error ? <p className="status error">{error}</p> : null}

        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
