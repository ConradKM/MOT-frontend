import { Ban, CircleCheck, Clock, TicketCheck, type LucideIcon } from 'lucide-react'
import type { DiscountStatus } from '../../api/loyalty'

const STATUS_BADGES: Record<DiscountStatus, { label: string; className: string; Icon: LucideIcon }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-800', Icon: CircleCheck },
  USED: { label: 'Used', className: 'bg-sky-100 text-sky-800', Icon: TicketCheck },
  EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-700', Icon: Clock },
  DISABLED: { label: 'Disabled', className: 'bg-amber-100 text-amber-900', Icon: Ban },
}

/** A code's derived status - icon and text, never colour alone. */
export function StatusBadge({ status }: { status: DiscountStatus }) {
  const { label, className, Icon } = STATUS_BADGES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
