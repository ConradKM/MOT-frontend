const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

interface DialpadProps {
  value: string
  onChange: (value: string) => void
  /** When set, a key press sends a DTMF tone through this instead of editing
   * the number (used while a call is connected). */
  onDigit?: (digit: string) => void
  /** Freeze the number field (e.g. while a call is in progress). */
  disabled?: boolean
}

/** A phone-number field plus a numeric keypad. Before a call the keys build
 * the number; once `onDigit` is provided they send DTMF tones instead. */
export function Dialpad({ value, onChange, onDigit, disabled }: DialpadProps) {
  const dtmf = !!onDigit
  const press = (key: string) => {
    if (dtmf) onDigit?.(key)
    else onChange(value + key)
  }
  const backspace = () => onChange(value.slice(0, -1))

  return (
    <div className="max-w-xs">
      <label className="block text-sm font-medium text-slate-700" htmlFor="dialpad-number">
        Phone number
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="dialpad-number"
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="07123 456789"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-lg tracking-wide focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
        />
        <button
          type="button"
          onClick={backspace}
          disabled={!value || dtmf || disabled}
          aria-label="Backspace"
          className="shrink-0 rounded-md border border-slate-300 px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          ⌫
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={dtmf ? `Send ${key}` : `Dial ${key}`}
            className="rounded-md border border-slate-200 bg-slate-50 py-3 text-lg font-medium text-slate-800 hover:bg-slate-100"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
