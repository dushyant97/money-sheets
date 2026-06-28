import { Scanner, type IDetectedBarcode, type IScannerError } from '@yudiel/react-qr-scanner';

/** Map the scanner library's error kinds to friendly, actionable copy. */
function scannerErrorMessage(error: IScannerError): string {
  switch (error.kind) {
    case 'permission-denied':
    case 'security':
      return 'Camera access is required to scan. Allow the camera in your browser settings, or use Advanced setup.';
    case 'no-camera':
      return 'No camera was found on this device. Use Advanced setup instead.';
    case 'insecure-context':
      return 'Scanning needs a secure (https) connection.';
    case 'in-use':
      return 'The camera is being used by another app. Close it and try again.';
    case 'unsupported':
      return "This browser can't access the camera. Use Advanced setup instead.";
    default:
      return 'The camera could not be started. Try again or use Advanced setup.';
  }
}

/**
 * Live camera QR scanner. Emits the first decoded string and surfaces camera
 * problems (most importantly a denied permission) through `onError`.
 */
export function QrScanner({
  onResult,
  onError
}: {
  onResult: (raw: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="qr-scanner">
      <Scanner
        formats={['qr_code']}
        constraints={{ facingMode: 'environment' }}
        scanDelay={400}
        onScan={(codes: IDetectedBarcode[]) => {
          const raw = codes[0]?.rawValue;
          if (raw) onResult(raw);
        }}
        onError={(error: IScannerError) => onError(scannerErrorMessage(error))}
      />
    </div>
  );
}
