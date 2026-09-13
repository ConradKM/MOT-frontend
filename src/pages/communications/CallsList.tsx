import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCall, useCalls } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { Disclosure } from '../../components/Disclosure'
import { ContactShortcuts } from '../../components/communications/ContactShortcuts'
import type { CommunicationLog } from '../../api/communications'
import {
  callStatusBadgeClass,
  callStatusLabel,
  counterpartLabel,
  directionLabel,
  formatCallDuration,
  isMissedCall,
  stripWhatsAppPrefix,
  transcriptRoleLabel,
} from '../../lib/communications'
import { formatDateTime, formatTime } from '../../lib/datetime'

type Filter = 'ALL' | 'INBOUND' | 'OUTBOUND' | 'MISSED'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All calls' },
  { key: 'INBOUND', label: 'Incoming' },
  { key: 'OUTBOUND', label: 'Outgoing' },
  { key: 'MISSED', label: 'Missed' },
]

const PAGE_SIZE = 25

function CallTranscript({ callId }: { callId: string }) {
  const { data, isLoading } = useCall(callId)
  const turns = data?.transcript ?? []

  if (isLoading) {
    return <p className="mt-4 text-xs text-slate-400">Loading transcript…</p>
  }
  if (turns.length === 0) return null

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <p className="mb-2 text-xs font-medium uppercase text-slate-400">Conversation</p>
      <ol className="space-y-2">
        {turns.map((turn) => (
          <li key={turn.id} className="flex gap-3 text-sm">
            <span className="w-14 shrink-0 text-xs text-slate-400">
              {formatTime(turn.created_at)}
            </span>
            <span
              className={`w-16 shrink-0 text-xs font-medium ${
                turn.direction === 'INBOUND' ? 'text-slate-700' : 'text-slate-500'
              }`}
            >
              {transcriptRoleLabel(turn.direction)}
            </span>
            <span className="text-slate-700">{turn.body}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CallDetailRow({ call, garageId }: { call: CommunicationLog; garageId: string }) {
  const number = stripWhatsAppPrefix(call.direction === 'INBOUND' ? call.from_address : call.to_address)

  return (
    <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
      <td colSpan={7} className="px-4 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-700">Customer</dt>
            <dd className="text-slate-600">
              {call.customer ? (
                <Link
                  to={`/${garageId}/customers/${call.customer.id}`}
                  className="text-slate-900 hover:underline"
                >
                  {call.customer.first_name} {call.customer.last_name}
                </Link>
              ) : (
                'Unknown caller'
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Phone number</dt>
            <dd className="text-slate-600">{number ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Date/time</dt>
            <dd className="text-slate-600">{formatDateTime(call.created_at)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Duration</dt>
            <dd className="text-slate-600">{formatCallDuration(call.call_duration_seconds)}</dd>
          </div>
          {call.appointment && (
            <div>
              <dt className="font-medium text-slate-700">Related appointment</dt>
              <dd className="text-slate-600">
                <Link
                  to={`/${garageId}/appointments/${call.appointment.id}/overview`}
                  className="text-slate-900 hover:underline"
                >
                  {formatDateTime(call.appointment.start_time)}
                </Link>
              </dd>
            </div>
          )}
          {call.booking_request && (
            <div>
              <dt className="font-medium text-slate-700">Related booking request</dt>
              <dd className="text-slate-600">
                <Link to={`/${garageId}/booking-requests`} className="text-slate-900 hover:underline">
                  {call.booking_request.status}
                </Link>
              </dd>
            </div>
          )}
          {call.error_message && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-700">Error</dt>
              <dd className="text-slate-600">{call.error_message}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <ContactShortcuts
            customerId={call.customer?.id}
            phone={number}
            name={call.customer ? `${call.customer.first_name} ${call.customer.last_name}` : undefined}
          />
          {!call.customer && number && (
            <Link
              to={`/${garageId}/customers/new?phone=${encodeURIComponent(number)}`}
              className="text-sm font-medium text-slate-500 hover:underline"
            >
              Add customer
            </Link>
          )}
        </div>

        <CallTranscript callId={call.id} />

        {call.external_id && (
          <div className="mt-4">
            <Disclosure title="Technical details">
              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <dt>Call reference</dt>
                <dd className="font-mono">{call.external_id}</dd>
                <dt>Provider</dt>
                <dd>{call.external_provider}</dd>
              </dl>
            </Disclosure>
          </div>
        )}
      </td>
    </tr>
  )
}

function CallRow({
  call,
  garageId,
  expanded,
  onToggle,
}: {
  call: CommunicationLog
  garageId: string
  expanded: boolean
  onToggle: () => void
}) {
  const missed = isMissedCall(call)
  const number = stripWhatsAppPrefix(call.direction === 'INBOUND' ? call.from_address : call.to_address)

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${missed ? 'bg-red-50/40' : ''}`}
      >
        <td className="px-4 py-2">
          <p className="font-medium text-slate-900">{counterpartLabel(call)}</p>
          {call.customer && <p className="text-xs text-slate-500">{number}</p>}
        </td>
        <td className="px-4 py-2 text-slate-600">{directionLabel(call.direction)}</td>
        <td className="px-4 py-2 text-slate-600">{formatDateTime(call.created_at)}</td>
        <td className="px-4 py-2 text-slate-600">{formatCallDuration(call.call_duration_seconds)}</td>
        <td className="px-4 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${callStatusBadgeClass(call)}`}
          >
            {missed ? 'MISSED' : callStatusLabel(call)}
          </span>
        </td>
        <td className="px-4 py-2 text-right text-sm font-medium text-slate-500">
          {expanded ? 'Hide' : 'View'}
        </td>
      </tr>
      {expanded && <CallDetailRow call={call} garageId={garageId} />}
    </>
  )
}

export function CallsList() {
  const garageId = useGarageId()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setOffset(0)
  }, [filter, search])

  const { data, isLoading } = useCalls({
    direction: filter === 'INBOUND' || filter === 'OUTBOUND' ? filter : undefined,
    missed_only: filter === 'MISSED',
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  const total = data?.total ?? 0
  const items = data?.items ?? []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search customer name or phone number…"
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No calls to show yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Direction</th>
                <th className="px-4 py-2 font-medium">Date/time</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  garageId={garageId}
                  expanded={expandedId === call.id}
                  onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
