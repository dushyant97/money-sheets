/**
 * Modal progress overlay shared by the import and export flows. Renders a
 * spinner, a title/subtitle, and a determinate progress bar driven by a
 * 0..1 fraction.
 */
export function ProgressOverlay({
  value,
  title,
  subtitle
}: {
  value: number;
  title: string;
  subtitle: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="modal-backdrop">
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-modal-head">
          <span className="import-spin" aria-hidden />
          <div>
            <strong>{title}</strong>
            <span className="muted">{subtitle}</span>
          </div>
        </div>
        <div className="import-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className="import-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="import-pct">{pct}%</div>
      </div>
    </div>
  );
}
