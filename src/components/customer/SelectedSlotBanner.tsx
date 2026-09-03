import { formatLongDate } from '../../lib/datetime'

interface Props {
  date: string
  time: string
  onChange: () => void
}

/** Persistent reminder of the slot the customer picked, shown from the moment
 * a slot is selected through the rest of the wizard. */
export function SelectedSlotBanner({ date, time, onChange }: Props) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
      <div className="text-sm">
        <p className="font-medium text-emerald-900">Your selected time</p>
        <p className="text-emerald-800">
          {formatLongDate(date)} at {time}
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-md border border-emerald-400 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
      >
        Change
      </button>
    </div>
  )
}
