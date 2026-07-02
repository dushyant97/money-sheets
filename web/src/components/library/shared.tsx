/**
 * Shared primitives for the Library (categories & accounts) editing surfaces,
 * used by both the mobile Budgets & Data sub-screens and the desktop manage
 * panel. Keeping the emoji/colour palettes and picker here avoids duplicating
 * them across App.tsx and the library screens.
 */

export const EMOJI_CHOICES = [
  '🛒', '🍜', '🍔', '☕', '⛽', '🚌', '🚗', '✈️', '🏠', '🛠️', '👕', '🎁',
  '🩺', '💊', '🏥', '💸', '📄', '📒', '🎓', '🎮', '🎵', '⚽', '🐾', '🌿',
  '💡', '📱', '💳', '🍷', '🏋️', '💰', '💵', '🏦', '📦', '🧾', '📌', '🎯'
];

export const COLOR_CHOICES = [
  '#4f7cff', '#ff5d8f', '#ffb020', '#22c08b', '#9b6bff', '#ff7a45',
  '#22c3e6', '#f2495c', '#7ed957', '#c44dff', '#34d399', '#fbbf24'
];

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR ₹' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'JPY', label: 'JPY ¥' }
];

export function EmojiColorPicker({
  emoji,
  color,
  onEmoji,
  onColor
}: {
  emoji: string;
  color: string;
  onEmoji: (value: string) => void;
  onColor: (value: string) => void;
}) {
  return (
    <>
      <div className="swatch-row">
        {COLOR_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${color === c ? 'on' : ''}`}
            style={{ backgroundColor: c }}
            title={c}
            aria-label={`Use colour ${c}`}
            onClick={() => onColor(c)}
          />
        ))}
        <button
          type="button"
          className={`swatch clear ${!color ? 'on' : ''}`}
          title="Default colour"
          aria-label="Use default colour"
          onClick={() => onColor('')}
        >
          ∅
        </button>
      </div>
      <div className="emoji-palette">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            className={`emoji-pick ${emoji === e ? 'on' : ''}`}
            onClick={() => onEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
