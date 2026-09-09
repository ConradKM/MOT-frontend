import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useAppointments,
  useCommunicationsOverview,
  useCustomer,
  useCustomers,
  useSendWhatsAppMessage,
  useVehicles,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage } from '../../lib/errors'
import { Dialpad } from '../../components/communications/Dialpad'
import { useTwilioDevice, type DialerStatus } from '../../hooks/useTwilioDevice'
import { formatDateTime } from '../../lib/datetime'
import type { Customer } from '../../types'

type Tab = 'call' | 'whatsapp'

const STATUS_LABEL: Record<DialerStatus, string> = {
  initialising: 'Connecting…',
  ready: 'Ready',
  calling: 'Calling…',
  ringing: 'Ringing…',
  connected: 'Connected',
  ended: 'Call ended',
  failed: 'Call failed',
}

function Dialler({ phone, enabled }: { phone: string; enabled: boolean }) {
  const [number, setNumber] = useState(phone)
  const {
    status,
    error,
    isMuted,
    startCall,
    hangUp,
    toggleMute,
    sendDigit,
  } = useTwilioDevice({ enabled })

  const inCall = status === 'calling' || status === 'ringing' || status === 'connected'
  const dialNumber = inCall ? phone || number : number

  if (!enabled) {
    return (
      <div>
        <Dialpad value={number} onChange={setNumber} />
        <p className="mt-3 max-w-xs text-xs text-slate-500">
          Browser calling isn't switched on for your business yet.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xs">
      <Dialpad
        value={dialNumber}
        onChange={setNumber}
        onDigit={status === 'connected' ? sendDigit : undefined}
        disabled={inCall}
      />

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            status === 'connected'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'failed'
                ? 'bg-red-100 text-red-700'
                : inCall
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!inCall ? (
          <button
            type="button"
            aria-label="Place call"
            onClick={() => startCall(number)}
            disabled={status === 'initialising' || !number.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Call
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={hangUp}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Hang up
            </button>
            <button
              type="button"
              onClick={toggleMute}
              disabled={status !== 'connected'}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CustomerPicker({
  onSelect,
}: {
  onSelect: (customer: Customer) => void
}) {
  const [search, setSearch] = useState('')
  const { data: customers, isLoading } = useCustomers(search || undefined)

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor="customer-search">
        Select customer
      </label>
      <input
        id="customer-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone number…"
        className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      {search && (
        <div className="mt-2 max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>
          ) : customers && customers.length > 0 ? (
            customers.slice(0, 8).map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-xs text-slate-500">{c.phone ?? c.email ?? 'No contact details'}</p>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">No customers match.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SelectedCustomerCard({ customer }: { customer: Customer }) {
  const garageId = useGarageId()
  const { data: vehicles } = useVehicles({ customer_id: customer.id })
  const { data: appointments } = useAppointments({ customer_id: customer.id })

  const upcoming = useMemo(() => {
    if (!appointments) return null
    const now = Date.now()
    return appointments
      .filter((a) => new Date(a.start_time).getTime() > now && a.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  }, [appointments])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900">
            {customer.first_name} {customer.last_name}
          </p>
          <p className="text-sm text-slate-500">{customer.phone ?? 'No mobile number on file'}</p>
        </div>
        <Link
          to={`/${garageId}/customers/${customer.id}`}
          className="text-sm font-medium text-slate-500 hover:underline"
        >
          View customer
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-400">Vehicles</dt>
          <dd className="text-slate-700">
            {vehicles && vehicles.length > 0
              ? vehicles.map((v) => v.registration_number).join(', ')
              : 'None on file'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-400">Upcoming appointment</dt>
          <dd className="text-slate-700">
            {upcoming ? formatDateTime(upcoming.start_time) : 'None scheduled'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function ContactCustomer() {
  const garageId = useGarageId()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: overview } = useCommunicationsOverview()
  const sendMessage = useSendWhatsAppMessage()

  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null)
  const [whatsappBody, setWhatsappBody] = useState('')
  const [sent, setSent] = useState(false)

  const customerId = searchParams.get('customerId')
  const rawPhone = searchParams.get('phone')
  const rawName = searchParams.get('name')
  const tab = (searchParams.get('tab') as Tab | null) ?? 'call'

  // Arriving with ?customerId= (a shortcut from Customer/Appointment/Booking
  // Request) needs the full record fetched, not just the id - the picker
  // path already has it from the search results.
  const { data: linkedCustomer } = useCustomer(pickedCustomer ? undefined : (customerId ?? undefined))
  const selectedCustomer = pickedCustomer ?? linkedCustomer ?? null

  const hasTarget = !!selectedCustomer || !!customerId || !!rawPhone
  const targetPhone = selectedCustomer?.phone ?? rawPhone ?? ''
  const targetName = selectedCustomer
    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
    : rawName

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params)
  }

  const handleSendWhatsApp = async () => {
    if (!whatsappBody.trim()) return
    const effectiveCustomerId = selectedCustomer?.id ?? undefined
    try {
      await sendMessage.mutateAsync({
        customer_id: effectiveCustomerId,
        to: effectiveCustomerId ? undefined : targetPhone,
        body: whatsappBody.trim(),
      })
      setSent(true)
      setWhatsappBody('')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {!hasTarget && <CustomerPicker onSelect={setPickedCustomer} />}

      {selectedCustomer && <SelectedCustomerCard customer={selectedCustomer} />}

      {!selectedCustomer && rawPhone && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-medium text-slate-900">{targetName ?? 'Contact'}</p>
          {targetPhone && <p className="text-sm text-slate-500">{targetPhone}</p>}
        </div>
      )}

      {hasTarget && (
        <div>
          <div className="flex gap-1 border-b border-slate-200">
            {(['call', 'whatsapp'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                  tab === t
                    ? 'border-b-2 border-slate-900 text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t === 'call' ? 'Call' : 'WhatsApp'}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === 'call' ? (
              <Dialler
                phone={targetPhone}
                enabled={overview?.capabilities.outbound_calling_supported ?? false}
              />
            ) : (
              <div className="max-w-lg">
                {!targetPhone ? (
                  <p className="text-sm text-red-600">This customer has no phone number on file.</p>
                ) : (
                  <>
                    {sent && (
                      <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        Message recorded.{' '}
                        <Link
                          to={`/${garageId}/communications/whatsapp?phone=${encodeURIComponent(targetPhone)}`}
                          className="font-medium underline"
                        >
                          View conversation
                        </Link>
                      </p>
                    )}
                    <label className="block text-sm font-medium text-slate-700" htmlFor="whatsapp-body">
                      Message customer…
                    </label>
                    <textarea
                      id="whatsapp-body"
                      value={whatsappBody}
                      onChange={(e) => setWhatsappBody(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSendWhatsApp}
                      disabled={sendMessage.isPending || !whatsappBody.trim()}
                      className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {sendMessage.isPending ? 'Sending…' : 'Send'}
                    </button>
                    {!overview?.capabilities.whatsapp_configured && (
                      <p className="mt-2 text-xs text-amber-700">
                        WhatsApp is not connected yet - this will be logged but not actually
                        delivered.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
