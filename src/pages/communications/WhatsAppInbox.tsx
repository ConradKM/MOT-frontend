import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useConversationAutomationStatus,
  useConversationMessages,
  useConversations,
  useCommunicationsOverview,
  useMarkConversationRead,
  useResumeConversationAutomation,
  useSendWhatsAppMessage,
  useTakeoverConversation,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import type { CommunicationLog, Conversation } from '../../api/communications'
import { formatRecentTimestamp, whatsappStatusLabel } from '../../lib/communications'
import { formatDateTime } from '../../lib/datetime'

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
}) {
  const name = conversation.customer
    ? `${conversation.customer.first_name} ${conversation.customer.last_name}`
    : 'Unknown number'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${
        active ? 'bg-slate-100' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium text-slate-900">{name}</p>
        <span className="shrink-0 text-xs text-slate-400">
          {formatRecentTimestamp(conversation.last_message.created_at)}
        </span>
      </div>
      {conversation.customer && <p className="text-xs text-slate-400">{conversation.phone}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm text-slate-500">
          {conversation.last_message.direction === 'OUTBOUND' ? 'You: ' : ''}
          {conversation.last_message.body || '(no message text)'}
        </p>
        {conversation.unread_count > 0 && (
          <span className="shrink-0 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            {conversation.unread_count}
          </span>
        )}
      </div>
    </button>
  )
}

function MessageBubble({ message }: { message: CommunicationLog }) {
  const outbound = message.direction === 'OUTBOUND'
  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          outbound ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.body || '(no message text)'}</p>
        <p className={`mt-1 text-right text-xs ${outbound ? 'text-slate-300' : 'text-slate-400'}`}>
          {formatDateTime(message.created_at)}
          {outbound && ` · ${whatsappStatusLabel(message.status)}`}
        </p>
      </div>
    </div>
  )
}

/** The bot and a human must never reply to the same conversation at once -
 * this is the one control that decides which of them currently owns it. */
function AutomationControl({ phone }: { phone: string }) {
  const { data: status } = useConversationAutomationStatus(phone)
  const takeover = useTakeoverConversation()
  const resume = useResumeConversationAutomation()
  const { showToast } = useToast()

  if (!status || !status.status || status.status === 'COMPLETED' || status.status === 'EXPIRED') {
    return null
  }

  if (status.status === 'HUMAN_HANDOFF') {
    const handleResume = async () => {
      try {
        await resume.mutateAsync(phone)
        showToast('Automation resumed for this conversation.', 'success')
      } catch (err) {
        showToast(errorMessage(err))
      }
    }
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Needs a reply
        </span>
        <button
          type="button"
          onClick={handleResume}
          disabled={resume.isPending}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {resume.isPending ? 'Resuming…' : 'Resume automation'}
        </button>
      </div>
    )
  }

  // ACTIVE - the automated assistant currently owns this conversation.
  const handleTakeover = async () => {
    try {
      await takeover.mutateAsync(phone)
      showToast('You now own this conversation - the assistant will stop replying.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Assistant is replying
      </span>
      <button
        type="button"
        onClick={handleTakeover}
        disabled={takeover.isPending}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {takeover.isPending ? 'Taking over…' : 'Take over conversation'}
      </button>
    </div>
  )
}

export function WhatsAppInbox() {
  const garageId = useGarageId()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')

  const selectedPhone = searchParams.get('phone')
  const selectPhone = (phone: string | null) => {
    setSearchParams(phone ? { phone } : {})
  }

  const { data: overview } = useCommunicationsOverview()
  const { data: conversationsData, isLoading: conversationsLoading } = useConversations({ search })
  const { data: thread, isLoading: threadLoading } = useConversationMessages(
    selectedPhone ?? undefined,
  )
  const markRead = useMarkConversationRead()
  const sendMessage = useSendWhatsAppMessage()

  const conversations = conversationsData?.items ?? []

  // Selecting a conversation marks it read - the one place this happens, so
  // opening it from anywhere (this list, a shortcut link, Overview) behaves
  // the same way.
  useEffect(() => {
    if (!selectedPhone) return
    const conversation = conversations.find((c) => c.phone === selectedPhone)
    if (conversation && conversation.unread_count > 0) {
      markRead.mutate(selectedPhone)
    }
    // Deliberately not keyed on `conversations`/`markRead` (both get a new
    // identity on every refetch) - this only needs to re-run when the
    // selection changes or the list first loads, not on every poll tick.
  }, [selectedPhone, conversations.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!selectedPhone || !draft.trim()) return
    try {
      await sendMessage.mutateAsync({ to: selectedPhone, body: draft.trim() })
      setDraft('')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const whatsappConnected = overview?.capabilities.whatsapp_configured ?? false

  return (
    <div>
      {!whatsappConnected && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          WhatsApp is not connected yet - messages can still be reviewed here, but sending will be
          recorded as not delivered until it's activated for your garage.
        </div>
      )}

      <div className="flex h-[65vh] min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex w-full max-w-xs shrink-0 flex-col border-r border-slate-200">
          <div className="border-b border-slate-200 p-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">
                No WhatsApp conversations yet. They'll appear here as customers message you.
              </p>
            ) : (
              conversations.map((c) => (
                <ConversationRow
                  key={c.phone}
                  conversation={c}
                  active={c.phone === selectedPhone}
                  onSelect={() => selectPhone(c.phone)}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedPhone ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-400">
              Select a conversation to see its messages.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {thread?.customer
                      ? `${thread.customer.first_name} ${thread.customer.last_name}`
                      : 'Unknown number'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedPhone}</p>
                </div>
                <AutomationControl phone={selectedPhone} />
                <div className="flex gap-3 text-sm font-medium">
                  {thread?.customer && (
                    <Link
                      to={`/${garageId}/customers/${thread.customer.id}`}
                      className="text-slate-600 hover:underline"
                    >
                      View customer
                    </Link>
                  )}
                  {!thread?.customer && selectedPhone && (
                    <Link
                      to={`/${garageId}/customers/new?phone=${encodeURIComponent(selectedPhone)}`}
                      className="text-slate-600 hover:underline"
                    >
                      Add customer
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {threadLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : thread && thread.messages.length > 0 ? (
                  thread.messages.map((m) => <MessageBubble key={m.id} message={m} />)
                ) : (
                  <p className="text-sm text-slate-500">No messages yet.</p>
                )}
              </div>

              <div className="border-t border-slate-200 p-3">
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    rows={1}
                    placeholder="Message customer…"
                    className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sendMessage.isPending || !draft.trim()}
                    className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {sendMessage.isPending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                {!whatsappConnected && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Phone &amp; WhatsApp services are not connected yet - this will be logged but
                    not actually delivered.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
