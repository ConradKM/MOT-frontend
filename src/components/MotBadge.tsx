import { motStatus, motStatusClasses, motStatusLabel } from '../lib/mot'

export function MotBadge({ motExpiryDate }: { motExpiryDate: string | null }) {
  const status = motStatus(motExpiryDate)
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${motStatusClasses[status]}`}
    >
      {motStatusLabel[status]}
    </span>
  )
}
