import { Link } from 'react-router-dom'
import { useCommunicationsOverview } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import type { CommunicationLog } from '../../api/communications'
import {
  callStatusBadgeClass,
  callStatusLabel,
  counterpartLabel,
  directionLabel,
  formatRecentTimestamp,
  smsStatusBadgeClass,
  smsStatusLabel,
  whatsappStatusBadgeClass,
  whatsappStatusLabel,
} from '../../lib/communications'

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function RecentRow({ log }: { log: CommunicationLog }) {
  const garageId = useGarageId()
  const isWhatsApp = log.channel === 'WHATSAPP'
  const isSms = log.channel === 'SMS'
  const unread = (isWhatsApp || isSms) && log.direction === 'INBOUND' && !log.read_at

  const href = isWhatsApp
    ? `/${garageId}/communications/whatsapp`
    : isSms
      ? `/${garageId}/communications/sms`
      : `/${garageId}/communications/calls`

  const channelLabel = isWhatsApp ? 'WhatsApp' : isSms ? 'SMS' : 'Phone'
  const statusLabel = isWhatsApp
    ? whatsappStatusLabel(log.status)
    : isSms
      ? smsStatusLabel(log.status)
      : callStatusLabel(log)
  const statusBadgeClass = isWhatsApp
    ? whatsappStatusBadgeClass(log.status)
    : isSms
      ? smsStatusBadgeClass(log.status)
      : callStatusBadgeClass(log)

  return (
    <Link
      to={href}
      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{counterpartLabel(log)}</p>
        <p className="text-xs text-slate-500">
          {channelLabel} · {directionLabel(log.direction)}
        </p>
        {log.body && (
          <p className="mt-0.5 truncate text-sm text-slate-600" title={log.body}>
            &ldquo;{log.body}&rdquo;
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-slate-400">{formatRecentTimestamp(log.created_at)}</p>
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {unread ? 'Unread' : statusLabel}
        </span>
      </div>
    </Link>
  )
}

export function CommunicationsOverview() {
  const { data, isLoading } = useCommunicationsOverview()

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!data) return <p className="text-sm text-red-600">Couldn't load communications.</p>

  const { capabilities } = data

  return (
    <div>
      {!capabilities.communications_enabled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Phone &amp; WhatsApp services are not connected yet. Communication history will appear
          here once CoMaz OS communications are activated for your business.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Calls today" value={data.calls_today} />
        <SummaryCard label="Missed calls" value={data.missed_calls_today} />
        <SummaryCard label="WhatsApp unread" value={data.whatsapp_unread} />
        <SummaryCard label="SMS unread" value={data.sms_unread} />
        <SummaryCard label="Outgoing contacts" value={data.outgoing_contacts_today} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Recent communications</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {data.recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              Nothing yet. Calls, WhatsApp and SMS messages will show up here as they happen.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent.map((log) => (
                <RecentRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
