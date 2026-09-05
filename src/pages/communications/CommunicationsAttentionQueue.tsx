import { Link } from 'react-router-dom'
import { useAttentionQueue, useResumeConversationAutomation } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { formatRecentTimestamp } from '../../lib/communications'
import type { AttentionQueueItem } from '../../api/communications'

const INTENT_LABELS: Record<string, string> = {
  CREATE_BOOKING: 'Booking',
  CHECK_AVAILABILITY: 'Availability',
  CHECK_APPOINTMENT: 'Check appointment',
  RESCHEDULE_APPOINTMENT: 'Reschedule',
  CANCEL_APPOINTMENT: 'Cancel',
  APPOINTMENT_PRICE_QUERY: 'Price query',
  APPOINTMENT_TYPE_QUERY: 'Services query',
  BUSINESS_HOURS_QUERY: 'Opening hours',
  BUSINESS_LOCATION_QUERY: 'Location query',
  MOT_EXPIRY_QUERY: 'MOT expiry query',
  CUSTOMER_DETAILS_QUERY: 'Account query',
  CALLBACK_REQUEST: 'Callback request',
  SPEAK_TO_HUMAN: 'Asked for a person',
  GENERAL_QUERY: 'General query',
  UNKNOWN: 'Unclear message',
}

function AttentionRow({ item }: { item: AttentionQueueItem }) {
  const garageId = useGarageId()
  const { showToast } = useToast()
  const resume = useResumeConversationAutomation()

  const name = item.customer
    ? `${item.customer.first_name} ${item.customer.last_name}`
    : 'Unknown number'

  const handleResume = async () => {
    try {
      await resume.mutateAsync(item.phone)
      showToast('Automation resumed for this conversation.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-900">{name}</p>
          <span className="shrink-0 text-xs text-slate-400">{item.phone}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-600">{item.handoff_reason ?? 'Needs a reply.'}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          {item.intent && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              {INTENT_LABELS[item.intent] ?? item.intent}
            </span>
          )}
          <span>{formatRecentTimestamp(item.last_activity_at)}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          to={`/${garageId}/communications/whatsapp?phone=${encodeURIComponent(item.phone)}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open conversation
        </Link>
        <button
          type="button"
          onClick={handleResume}
          disabled={resume.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {resume.isPending ? 'Resuming…' : 'Resume automation'}
        </button>
      </div>
    </div>
  )
}

export function CommunicationsAttentionQueue() {
  const { data, isLoading } = useAttentionQueue()
  const items = data?.items ?? []

  return (
    <div>
      <p className="text-sm text-slate-500">
        Conversations the automated assistant couldn't resolve on its own and handed to a
        person - resolve them here, then hand automation back once you're done, or reply
        directly from WhatsApp.
      </p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Nothing needs attention right now.
          </p>
        ) : (
          items.map((item) => <AttentionRow key={item.phone} item={item} />)
        )}
      </div>
    </div>
  )
}
