const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

interface DialpadProps {
  value: string
  onChange: (value: string) => void
}

/** A phone-number field plus a numeric keypad for entering it - the base for
 * outbound calling. Deliberately plain/professional (a form control with a
 * keypad, not a phone-app skeuomorph). */
export function Dialpad({ value, onChange }: DialpadProps) {
  const press = (key: string) => onChange(value + key)
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
          placeholder="07123 456789"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-lg tracking-wide focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={backspace}
          disabled={!value}
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
            className="rounded-md border border-slate-200 bg-slate-50 py-3 text-lg font-medium text-slate-800 hover:bg-slate-100"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
