import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useArchiveConversation,
  useCommunicationsOverview,
  useConversationAutomationStatus,
  useConversationMessages,
  useConversations,
  useCustomers,
  useDeleteConversation,
  useMarkConversationRead,
  useRestoreConversation,
  useResumeConversationAutomation,
  useSendWhatsAppMessage,
  useTakeoverConversation,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { errorMessage, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import type { CommunicationLog, Conversation, ConversationFilter } from '../../api/communications'
import {
  formatPhoneDisplay,
  formatRecentTimestamp,
  stripWhatsAppPrefix,
  whatsappStatusLabel,
} from '../../lib/communications'
import { formatDateTime } from '../../lib/datetime'
import type { Customer } from '../../types'

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'archived', label: 'Archived' },
]

/** A send the provider actually rejected - never render these as "Sent".
 * `FAILED` is what POST /whatsapp/send returns synchronously; the lowercase
 * Twilio statuses arrive later via status-callback webhooks. */
function isFailedSend(status: string): boolean {
  return status === 'FAILED' || status === 'failed' || status === 'undelivered'
}

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
  const failed = isFailedSend(message.status)
  // The backend's business-facing reason wins ("Not delivered — outside the
  // 24-hour window…"); fall back to the old client-side label only if it's
  // an older row with no status_detail.
  const statusText = message.status_detail || whatsappStatusLabel(message.status)
  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          outbound ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.body || '(no message text)'}</p>
        <p
          className={`mt-1 text-right text-xs ${
            failed ? 'text-red-300' : outbound ? 'text-slate-300' : 'text-slate-400'
          }`}
        >
          {formatDateTime(message.created_at)}
          {outbound && ` · ${statusText}`}
        </p>
        {outbound && failed && message.template_required && (
          <p className="mt-0.5 text-right text-xs text-red-300">
            An approved WhatsApp template is needed to reach this customer.
          </p>
        )}
      </div>
    </div>
  )
}

/** The bot and a human must never reply to the same conversation at once. */
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
          {resume.isPending ? 'Resuming…' : 'Resume assistant'}
        </button>
      </div>
    )
  }

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
        {takeover.isPending ? 'Taking over…' : 'Take over'}
      </button>
    </div>
  )
}

function ConversationActionsMenu({
  conversation,
  onOpenThread,
}: {
  conversation: Conversation
  onOpenThread: (phone: string | null) => void
}) {
  const garageId = useGarageId()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const archive = useArchiveConversation()
  const restore = useRestoreConversation()
  const del = useDeleteConversation()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmingDelete(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const run = async (fn: () => Promise<void>, successMsg: string, closeThread = false) => {
    try {
      await fn()
      showToast(successMsg, 'success')
      setOpen(false)
      setConfirmingDelete(false)
      if (closeThread) onOpenThread(null)
    } catch (err) {
      showToast(
        isApiError(err) && err.code === 403
          ? 'Only the business owner can delete a conversation.'
          : errorMessage(err),
      )
    }
  }

  const callHref =
    `/${garageId}/communications/contact?tab=call&` +
    (conversation.customer
      ? `customerId=${conversation.customer.id}`
      : `phone=${encodeURIComponent(conversation.phone)}`)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Conversation actions"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {conversation.customer && (
            <Link
              to={`/${garageId}/customers/${conversation.customer.id}`}
              className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              View customer
            </Link>
          )}
          <Link to={callHref} className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Call customer
          </Link>
          {conversation.archived ? (
            <button
              type="button"
              onClick={() => run(() => restore.mutateAsync(conversation.phone), 'Conversation restored.')}
              className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                run(() => archive.mutateAsync(conversation.phone), 'Conversation archived.', true)
              }
              className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              Archive
            </button>
          )}
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="block w-full border-t border-slate-100 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
            >
              Delete…
            </button>
          ) : (
            <div className="border-t border-slate-100 px-3 py-2">
              <p className="text-xs text-slate-500">
                Removes it from CoMaz. History is kept and no WhatsApp messages are unsent.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={del.isPending}
                  onClick={() =>
                    run(
                      () => del.mutateAsync(conversation.phone),
                      'Conversation deleted.',
                      true,
                    )
                  }
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NewMessageModal({
  existingConversations,
  onClose,
  onOpenThread,
}: {
  existingConversations: Conversation[]
  onClose: () => void
  onOpenThread: (phone: string) => void
}) {
  const { showToast } = useToast()
  const send = useSendWhatsAppMessage()
  const [mode, setMode] = useState<'customer' | 'number'>('customer')
  const [customerSearch, setCustomerSearch] = useState('')
  const { data: customers } = useCustomers(customerSearch || undefined)
  // The whole chosen record is held here, not just an id looked up against the
  // current (search-dependent) results list - so the selection stays visible
  // and correct even after the search box is changed, and a stale previous
  // pick can never be the one that actually gets messaged.
  const [selected, setSelected] = useState<Customer | null>(null)
  const [number, setNumber] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const trimmedNumber = number.trim()
  const targetPhone = mode === 'customer' ? (selected?.phone ?? '') : trimmedNumber
  const hasValidTarget =
    mode === 'customer' ? !!selected && !!selected.phone : trimmedNumber.length >= 7
  const canSend = hasValidTarget && !!body.trim() && !send.isPending

  const clearSelection = () => {
    setSelected(null)
    setError(null)
  }

  const submit = async () => {
    setError(null)
    if (!canSend) return

    // Already have a thread for this number? Just open it - don't duplicate.
    if (targetPhone) {
      const existing = existingConversations.find((c) => c.phone === targetPhone)
      if (existing) {
        onOpenThread(existing.phone)
        return
      }
    }

    try {
      const result = await send.mutateAsync({
        customer_id: mode === 'customer' ? selected?.id : undefined,
        to: mode === 'number' ? trimmedNumber : undefined,
        body: body.trim(),
      })
      const phone = stripWhatsAppPrefix(result.to_address) ?? targetPhone
      if (isFailedSend(result.status)) {
        setError(
          result.status_detail ||
            result.error_message ||
            "WhatsApp rejected that message - it wasn't sent.",
        )
        return
      }
      if (result.status === 'SKIPPED_NOT_CONFIGURED') {
        showToast('Recorded, but WhatsApp isn’t connected so it wasn’t delivered.')
      } else {
        showToast('Message sent.', 'success')
      }
      if (phone) onOpenThread(phone)
      else onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New message</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-1 text-sm">
          {(['customer', 'number'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`rounded-md px-3 py-1.5 font-medium ${
                mode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m === 'customer' ? 'Existing customer' : 'New number'}
            </button>
          ))}
        </div>

        {mode === 'customer' ? (
          <div className="mt-3">
            {selected ? (
              <div className="flex items-start justify-between gap-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selected.first_name} {selected.last_name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selected.phone
                      ? formatPhoneDisplay(selected.phone)
                      : 'No mobile number on file'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers by name or number…"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                {customerSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                    {(customers ?? []).slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelected(c)
                          setCustomerSearch('')
                          setError(null)
                        }}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {c.phone ? formatPhoneDisplay(c.phone) : 'no number'}
                        </span>
                      </button>
                    ))}
                    {(customers ?? []).length === 0 && (
                      <p className="px-3 py-1.5 text-sm text-slate-500">No customers match.</p>
                    )}
                  </div>
                )}
              </>
            )}
            {selected && !selected.phone && (
              <p className="mt-1 text-xs text-amber-700">
                This customer has no mobile number on file - add one on their record, or use
                "New number".
              </p>
            )}
          </div>
        ) : (
          <input
            type="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="07123 456789"
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}

        <label className="mt-3 block text-xs font-medium text-slate-500" htmlFor="new-message-body">
          {mode === 'customer' && selected
            ? `Message to ${selected.first_name} ${selected.last_name}`
            : mode === 'number' && trimmedNumber
              ? `Message to ${formatPhoneDisplay(trimmedNumber)}`
              : 'Message'}
        </label>
        <textarea
          id="new-message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Message…"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function WhatsAppInbox() {
  const garageId = useGarageId()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<ConversationFilter>('inbox')
  const [newMessageOpen, setNewMessageOpen] = useState(false)

  const selectedPhone = searchParams.get('phone')
  const selectPhone = (phone: string | null) => {
    setSearchParams(phone ? { phone } : {})
  }

  const { data: overview } = useCommunicationsOverview()
  const { data: conversationsData, isLoading: conversationsLoading } = useConversations({
    filter,
    search,
  })
  const { data: thread, isLoading: threadLoading } = useConversationMessages(
    selectedPhone ?? undefined,
  )
  const markRead = useMarkConversationRead()
  const sendMessage = useSendWhatsAppMessage()

  const conversations = conversationsData?.items ?? []
  const activeConversation = conversations.find((c) => c.phone === selectedPhone) ?? null

  useEffect(() => {
    if (!selectedPhone) return
    const conversation = conversations.find((c) => c.phone === selectedPhone)
    if (conversation && conversation.unread_count > 0) {
      markRead.mutate(selectedPhone)
    }
  }, [selectedPhone, conversations.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!selectedPhone || !draft.trim()) return
    try {
      const result = await sendMessage.mutateAsync({ to: selectedPhone, body: draft.trim() })
      if (isFailedSend(result.status)) {
        showToast(result.error_message || "WhatsApp rejected that message - it wasn't sent.")
        return
      }
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
          recorded as not delivered until it's activated for your business.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
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
        <button
          type="button"
          onClick={() => setNewMessageOpen(true)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New message
        </button>
      </div>

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
                {filter === 'archived'
                  ? 'No archived conversations.'
                  : filter === 'needs_attention'
                    ? 'Nothing needs a reply right now.'
                    : "No WhatsApp conversations yet. They'll appear here as customers message you."}
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
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {thread?.customer
                      ? `${thread.customer.first_name} ${thread.customer.last_name}`
                      : 'Unknown number'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedPhone}</p>
                </div>
                <AutomationControl phone={selectedPhone} />
                <div className="flex shrink-0 items-center gap-2">
                  {!thread?.customer && (
                    <Link
                      to={`/${garageId}/customers/new?phone=${encodeURIComponent(selectedPhone)}`}
                      className="text-sm font-medium text-slate-600 hover:underline"
                    >
                      Add customer
                    </Link>
                  )}
                  {activeConversation && (
                    <ConversationActionsMenu
                      conversation={activeConversation}
                      onOpenThread={selectPhone}
                    />
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

      {newMessageOpen && (
        <NewMessageModal
          existingConversations={conversations}
          onClose={() => setNewMessageOpen(false)}
          onOpenThread={(phone) => {
            setNewMessageOpen(false)
            setFilter('inbox')
            selectPhone(phone)
          }}
        />
      )}
    </div>
  )
}
