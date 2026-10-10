import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAcceptTerms, usePublicGarage, useTermsAcceptanceLookup } from '../../api/queries'
import { TERMS_VERSION_MISMATCH, type TermsAcceptanceLookup } from '../../api/terms'
import { BusinessBrandMark } from '../../components/BusinessBrandMark'
import { TermsAcceptance } from '../../components/customer/TermsAcceptance'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, isApiError } from '../../lib/errors'

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-card" role="status">
      <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  )
}

/**
 * Where a customer who booked by WhatsApp, text or phone accepts the
 * business's Terms & Conditions (`/accept-terms/:garageId#<token>`). Until
 * they do, the booking only holds the slot. Accepting sends a normal booking
 * request - or, for a deposit service, continues straight into the booking
 * page's existing checkout, so the deposit is only ever taken afterwards.
 *
 * The token rides in the URL fragment, which browsers never send to a server;
 * the page posts it in a request body instead.
 */
export function AcceptTermsPage() {
  const { garageId } = useParams<{ garageId: string }>()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const token = hash.replace(/^#/, '') || null

  const { data: garage, isLoading: garageLoading } = usePublicGarage(garageId)
  const lookup = useTermsAcceptanceLookup(garage?.slug, token)
  const accept = useAcceptTerms(garage?.slug, token)

  const [accepted, setAccepted] = useState(false)
  const [termsError, setTermsError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedReference, setSubmittedReference] = useState<string | null | undefined>()

  if (!token) {
    return (
      <Notice
        title="This link is incomplete"
        body="Please open the full link from the message the business sent you."
      />
    )
  }
  if (garageLoading || lookup.isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!garage || !garageId) {
    return <Notice title="Business not found" body="Please check the link you were sent." />
  }
  if (submittedReference !== undefined) {
    return (
      <Notice
        title="Booking request sent"
        body={`Thanks - ${garage.name} will review your request and be in touch to confirm.${
          submittedReference ? ` Your reference is ${submittedReference}.` : ''
        }`}
      />
    )
  }
  if (lookup.isError || !lookup.data) {
    return (
      <Notice
        title="We couldn't find that booking"
        body="This link isn't valid. Please check you opened the full link, or contact the business."
      />
    )
  }

  const data: TermsAcceptanceLookup = lookup.data
  if (data.state === 'ACCEPTED') {
    return (
      <Notice
        title="Already accepted"
        body={`You've already accepted the terms for this booking with ${data.garage_name}. There's nothing more to do here.`}
      />
    )
  }
  if (data.state === 'EXPIRED') {
    return (
      <Notice
        title="This booking has expired"
        body={`Your slot was only held for a limited time. Please get in touch with ${data.garage_name} to book again.`}
      />
    )
  }
  if (data.state === 'CLOSED') {
    return (
      <Notice
        title="This booking can't be confirmed here"
        body={`Please get in touch with ${data.garage_name} about this booking.`}
      />
    )
  }

  const terms = data.terms_and_conditions?.trim() ? data.terms_and_conditions : null
  const booking = data.booking

  const confirm = async () => {
    setFormError(null)
    if (terms && !accepted) {
      setTermsError('Please accept the terms and conditions to continue.')
      return
    }
    try {
      const result = await accept.mutateAsync(terms ? data.terms_version : null)
      if (result.recovery_token) {
        // A deposit booking: the booking page's own resume flow takes it from
        // here, straight into the same checkout as any online booking.
        navigate(`/book/${garageId}?resume=${encodeURIComponent(result.recovery_token)}`)
        return
      }
      setSubmittedReference(result.booking_reference)
    } catch (err) {
      if (isApiError(err) && err.code === 409 && err.reason === TERMS_VERSION_MISMATCH) {
        // Edited while this page was open; the lookup refetches the new wording.
        setAccepted(false)
        setFormError('The terms were updated. Please read and accept the latest version.')
        return
      }
      // Already accepted / expired in the meantime: the refetched lookup
      // swaps this view for the matching message.
      setFormError(errorMessage(err))
    }
  }

  const blocked = Boolean(terms) && !accepted

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} />
        <div>
          <p className="text-sm font-medium text-slate-500">Confirm your booking</p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            {data.garage_name}
          </h1>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-card">
        <p className="text-sm text-slate-600">
          Hi {booking.customer_first_name}, your slot is being held. It isn't booked until you
          accept {data.garage_name}'s terms and conditions.
        </p>

        <dl className="mt-4 space-y-1 rounded-md border border-slate-200 p-4 text-sm">
          {booking.service_name && <Row label="Service" value={booking.service_name} />}
          {booking.add_ons.length > 0 && (
            <Row
              label="Add-ons"
              value={booking.add_ons
                .map((a) => (a.quantity > 1 ? `${a.quantity}× ${a.name}` : a.name))
                .join(', ')}
            />
          )}
          <Row label="Date" value={formatLongDate(booking.preferred_date)} />
          {booking.preferred_time && <Row label="Time" value={booking.preferred_time.slice(0, 5)} />}
          {booking.vehicle_registration && (
            <Row label="Vehicle" value={booking.vehicle_registration} />
          )}
          {booking.price && <Row label="Price" value={`£${booking.price}`} />}
          {booking.booking_reference && <Row label="Reference" value={booking.booking_reference} />}
        </dl>

        {booking.deposit_required && (
          <p className="mt-3 text-sm text-slate-600">
            This service needs a deposit - you'll pay it securely on the next page.
          </p>
        )}

        {terms && (
          <div className="mt-5">
            <TermsAcceptance
              terms={terms}
              garageId={garageId}
              accepted={accepted}
              onChange={(next) => {
                setAccepted(next)
                if (next) setTermsError(undefined)
              }}
              error={termsError}
            />
          </div>
        )}

        {formError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {formError}
          </p>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={accept.isPending}
          aria-disabled={blocked || undefined}
          className={`mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 ${
            blocked ? 'opacity-50' : ''
          }`}
        >
          {accept.isPending
            ? 'Confirming…'
            : booking.deposit_required
              ? 'Confirm and continue to payment'
              : 'Confirm booking'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  )
}
