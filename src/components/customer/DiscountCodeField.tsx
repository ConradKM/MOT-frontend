import { useId, useState, type FormEvent } from 'react'
import { validateDiscountCode, type DiscountValidation } from '../../api/publicGarage'
import { errorMessage } from '../../lib/errors'

interface Props {
  slug: string
  appointmentTypeId: string
  customerEmail: string
  addOns: { add_on_id: string; quantity: number }[]
  applied: DiscountValidation | null
  /** Resolves false if the wizard couldn't switch to the new price (e.g. a
   * deposit already being confirmed) - the field then keeps what it had. */
  onApply: (result: DiscountValidation) => Promise<boolean> | boolean
  onRemove: () => Promise<boolean> | boolean
}

/**
 * The checkout's "Have a discount code?" control. Collapsed until asked
 * for; Apply checks the code with the server, which answers with the new
 * total and deposit - nothing here computes a price. Every way a code can
 * be wrong gets the server's one generic message, by design.
 *
 * The wizard owns the applied result and clears it whenever the service,
 * add-ons or email change, since the server must re-check it for those.
 */
export function DiscountCodeField({
  slug,
  appointmentTypeId,
  customerEmail,
  addOns,
  applied,
  onApply,
  onRemove,
}: Props) {
  const inputId = useId()
  const errorId = useId()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter a discount code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await validateDiscountCode(slug, {
        code: trimmed,
        appointment_type_id: appointmentTypeId,
        customer_email: customerEmail,
        add_ons: addOns,
      })
      if (await onApply(result)) setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRemove()
    } finally {
      setBusy(false)
    }
  }

  if (applied) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <p className="text-emerald-900">
          Discount code <span className="font-mono font-semibold">{applied.code}</span> applied
        </p>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="min-h-11 rounded-md px-2 font-medium text-emerald-900 underline hover:text-emerald-950 disabled:opacity-50 sm:min-h-0"
        >
          {busy ? 'Removing…' : 'Remove code'}
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="min-h-11 text-sm font-medium text-slate-700 underline hover:text-slate-900 sm:min-h-0"
      >
        Have a discount code?
      </button>
    )
  }

  return (
    <form onSubmit={apply} noValidate className="rounded-md border border-slate-200 p-3">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
        Discount code
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={inputId}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            if (error) setError(null)
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0"
        >
          {busy ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
