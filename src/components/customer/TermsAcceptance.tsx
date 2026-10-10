import { useId, useRef, useState } from 'react'
import { Modal } from '../Modal'
import { termsPath } from '../../lib/bookingUrl'

interface TermsAcceptanceProps {
  /** The business's terms - plain text, rendered as text (never HTML). */
  terms: string
  /** Business id, for the "Open in new tab" link to the standalone page. */
  garageId: string
  accepted: boolean
  onChange: (accepted: boolean) => void
  /** A required-field style validation message. */
  error?: string
  disabled?: boolean
}

/**
 * "I have read and accept the terms and conditions" - the one acceptance
 * control every customer-facing booking page uses (booking wizard, walk-in
 * queue, accepting a WhatsApp/SMS/phone booking).
 *
 * The link opens the terms in a popup whose text scrolls on its own, between
 * a fixed title and fixed Accept / Close buttons. Accept ticks the box and
 * closes; Close leaves it as it was. Reading to the bottom is deliberately
 * not required - the checkbox is the acceptance, the server records it.
 */
export function TermsAcceptance({
  terms,
  garageId,
  accepted,
  onChange,
  error,
  disabled = false,
}: TermsAcceptanceProps) {
  const [open, setOpen] = useState(false)
  const linkRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const errorId = `${id}-error`

  const close = () => {
    setOpen(false)
    // Back to where the customer was, not the top of the page.
    window.setTimeout(() => linkRef.current?.focus(), 0)
  }

  const accept = () => {
    onChange(true)
    close()
  }

  return (
    <div>
      <div className="flex items-start gap-2 text-sm text-slate-700">
        <input
          id={id}
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        {/* The link sits outside the <label> so opening the terms never
            toggles the box as a side effect. */}
        <span>
          <label htmlFor={id}>I have read and accept the </label>
          <button
            ref={linkRef}
            type="button"
            onClick={() => setOpen(true)}
            className="font-medium text-slate-900 underline hover:text-slate-700"
          >
            terms and conditions
          </button>
        </span>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      <Modal
        open={open}
        title="Terms and conditions"
        bodyLabel="Terms and conditions text"
        onClose={close}
        wide
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={termsPath(garageId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Open in new tab
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={disabled}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </div>
        }
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {terms}
        </p>
      </Modal>
    </div>
  )
}
