import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, Mail, MessageSquareText, Phone } from 'lucide-react'
import { useGarageId } from '../hooks/useGarageId'
import { SUPPORT_EMAIL, SUPPORT_PHONE_NUMBER } from '../lib/support'

const ITEM_CLASS =
  'flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50'

/** Business Dashboard only - the "Need Help?" navbar button and its Feedback /
 * Email Support / Call Us dropdown. Never rendered from the customer-facing
 * booking pages (see components/customer/CustomerLayout.tsx, which has no
 * reference to this component). */
export function NeedHelpMenu() {
  const garageId = useGarageId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <CircleHelp className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        Need Help?
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Need Help?"
          className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          <Link
            to={`/${garageId}/feedback`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM_CLASS}
          >
            <MessageSquareText className="h-4 w-4 text-slate-400" />
            Feedback
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} role="menuitem" className={ITEM_CLASS}>
            <Mail className="h-4 w-4 text-slate-400" />
            Email Support
          </a>
          {SUPPORT_PHONE_NUMBER ? (
            <a href={`tel:${SUPPORT_PHONE_NUMBER}`} role="menuitem" className={ITEM_CLASS}>
              <Phone className="h-4 w-4 text-slate-400" />
              Call Us
            </a>
          ) : (
            <div
              role="menuitem"
              aria-disabled="true"
              title="Support number unavailable"
              className="flex cursor-not-allowed items-start gap-2 px-3 py-2 text-slate-400"
            >
              <Phone className="mt-0.5 h-4 w-4" />
              <span>
                Call Us
                <span className="block text-xs">Support number unavailable</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
