import type { CommDirection, CommunicationLog } from '../api/communications'
import { formatDateShort, formatTime, localDateKey, todayIso } from './datetime'

// Mirrors app/communications/queries.py::MISSED_CALL_STATUSES - an inbound
// call that never connected.
const MISSED_CALL_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled'])

export function isMissedCall(call: Pick<CommunicationLog, 'direction' | 'status'>): boolean {
  return call.direction === 'INBOUND' && MISSED_CALL_STATUSES.has(call.status)
}

const CALL_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  ringing: 'Ringing',
  'in-progress': 'In progress',
  completed: 'Completed',
  busy: 'Busy',
  failed: 'Failed',
  'no-answer': 'No answer',
  canceled: 'Cancelled',
  received: 'Received',
  SKIPPED_NOT_CONFIGURED: 'Not sent — phone services not connected',
  FAILED: 'Failed',
}

const WHATSAPP_STATUS_LABELS: Record<string, string> = {
  queued: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  undelivered: 'Undelivered',
  received: 'Received',
  SKIPPED_NOT_CONFIGURED: 'Not sent — WhatsApp not connected',
  FAILED: 'Failed',
}

export function callStatusLabel(call: Pick<CommunicationLog, 'direction' | 'status'>): string {
  if (isMissedCall(call)) return 'Missed'
  return CALL_STATUS_LABELS[call.status] ?? call.status
}

export function whatsappStatusLabel(status: string): string {
  return WHATSAPP_STATUS_LABELS[status] ?? status
}

const GREEN = 'bg-emerald-100 text-emerald-700'
const BLUE = 'bg-blue-100 text-blue-700'
const RED = 'bg-red-100 text-red-700'
const SLATE = 'bg-slate-100 text-slate-600'
const VIOLET = 'bg-violet-100 text-violet-700'

export function callStatusBadgeClass(call: Pick<CommunicationLog, 'direction' | 'status'>): string {
  if (isMissedCall(call)) return RED
  if (call.status === 'completed') return GREEN
  if (call.status === 'ringing' || call.status === 'in-progress' || call.status === 'queued') {
    return BLUE
  }
  if (call.status === 'SKIPPED_NOT_CONFIGURED') return SLATE
  return SLATE
}

export function whatsappStatusBadgeClass(status: string): string {
  switch (status) {
    case 'delivered':
    case 'read':
      return GREEN
    case 'sent':
    case 'queued':
      return BLUE
    case 'failed':
    case 'undelivered':
    case 'FAILED':
      return RED
    case 'SKIPPED_NOT_CONFIGURED':
      return SLATE
    case 'received':
      return VIOLET
    default:
      return SLATE
  }
}

export function directionLabel(direction: CommDirection): string {
  if (direction === 'INBOUND') return 'Incoming'
  if (direction === 'OUTBOUND') return 'Outgoing'
  return 'System'
}

/** Who a single call-transcript turn is from, for the call detail timeline. */
export function transcriptRoleLabel(direction: CommDirection): string {
  if (direction === 'INBOUND') return 'Caller'
  if (direction === 'OUTBOUND') return 'Assistant'
  return 'System'
}

export function formatCallDuration(seconds: number | null): string {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/** A short, safe label for whoever's on the other end of a communication -
 * the matched customer's name, or the raw number for an unknown caller. */
export function counterpartLabel(log: {
  customer: { first_name: string; last_name: string } | null
  direction: CommDirection
  from_address: string | null
  to_address: string | null
}): string {
  if (log.customer) return `${log.customer.first_name} ${log.customer.last_name}`
  const address = log.direction === 'INBOUND' ? log.from_address : log.to_address
  return stripWhatsAppPrefix(address) ?? 'Unknown'
}

export function stripWhatsAppPrefix(address: string | null | undefined): string | null {
  if (!address) return null
  return address.startsWith('whatsapp:') ? address.slice('whatsapp:'.length) : address
}

/** "14:32" for something that happened today, otherwise "3 Sep". Used for
 * compact activity-feed style rows (Overview, conversation list). */
export function formatRecentTimestamp(iso: string): string {
  return localDateKey(iso) === todayIso() ? formatTime(iso) : formatDateShort(iso)
}
