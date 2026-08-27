export type MotStatus = 'expired' | 'expiring-soon' | 'ok' | 'unknown'

const SOON_DAYS = 30

export function motStatus(motExpiryDate: string | null): MotStatus {
  if (!motExpiryDate) return 'unknown'
  const days = (new Date(motExpiryDate).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'expired'
  if (days < SOON_DAYS) return 'expiring-soon'
  return 'ok'
}

export const motStatusLabel: Record<MotStatus, string> = {
  expired: 'Expired',
  'expiring-soon': 'Expiring soon',
  ok: 'Valid',
  unknown: 'Unknown',
}

export const motStatusClasses: Record<MotStatus, string> = {
  expired: 'bg-red-100 text-red-700',
  'expiring-soon': 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
  unknown: 'bg-slate-100 text-slate-500',
}
