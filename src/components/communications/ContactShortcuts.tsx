import { Link } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'

interface ContactShortcutsProps {
  customerId?: string | null
  phone?: string | null
  name?: string
  className?: string
}

/** [Call] [WhatsApp] buttons that route into the central Contact Customer
 * flow - used from Customer Detail, Appointment, and Booking Request pages
 * so there is exactly one place that actually places a call or sends a
 * WhatsApp message, not a separate implementation per page. */
export function ContactShortcuts({ customerId, phone, name, className }: ContactShortcutsProps) {
  const garageId = useGarageId()

  if (!customerId && !phone) return null

  const qs = new URLSearchParams()
  if (customerId) {
    qs.set('customerId', customerId)
  } else if (phone) {
    qs.set('phone', phone)
    if (name) qs.set('name', name)
  }

  const base = `/${garageId}/communications/contact?${qs.toString()}`

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <Link
        to={`${base}&tab=call`}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Call
      </Link>
      <Link
        to={`${base}&tab=whatsapp`}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        WhatsApp
      </Link>
    </div>
  )
}
