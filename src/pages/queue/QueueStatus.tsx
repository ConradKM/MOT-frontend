import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useLeaveQueue, usePublicGarage, useQueueStatus } from '../../api/queries'
import type { PublicQueueStatus } from '../../api/queue'
import { BusinessBrandMark } from '../../components/BusinessBrandMark'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatTime } from '../../lib/datetime'
import { errorMessage, isApiError } from '../../lib/errors'
import {
  QUEUE_STATUS_LABELS,
  clearStoredQueueToken,
  formatWait,
  readStoredQueueToken,
  storeQueueToken,
  tokenFromHash,
} from '../../lib/queue'
import { QueueNotice } from './QueueJoin'

/**
 * A walk-in's live place in the queue: `/queue/<garage id>/status#<token>`.
 * Polls (see useQueueStatus) - position and ETA are recomputed server-side on
 * every read, so this refreshes itself as people ahead are served or leave.
 */
export function QueueStatus() {
  const { garageId } = useParams<{ garageId: string }>()
  const location = useLocation()
  const [token] = useState<string | null>(
    () => tokenFromHash(location.hash) ?? (garageId ? readStoredQueueToken(garageId) : null),
  )
  const { data: garage, isLoading: garageLoading } = usePublicGarage(garageId)
  const { data: status, error, isLoading } = useQueueStatus(garage?.slug, token)
  const leave = useLeaveQueue(garage?.slug, token)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  // Opening the texted link on a new device should make "see your place"
  // work from the plain queue page there too.
  useEffect(() => {
    if (garageId && token) storeQueueToken(garageId, token)
  }, [garageId, token])

  const notFound = isApiError(error) && error.code === 404
  useEffect(() => {
    if (garageId && notFound) clearStoredQueueToken(garageId)
  }, [garageId, notFound])

  if (garageLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!garage || !garageId) {
    return (
      <QueueNotice
        title="Business not found"
        body="We couldn't find that business — check the link you were sent."
      />
    )
  }
  if (!token || notFound) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <QueueNotice
          title="We couldn't find your place"
          body="Use the link from when you joined the queue, or ask at reception."
        />
        <Link to={`/queue/${garageId}`} className="text-sm font-medium text-slate-900 underline">
          Join the queue
        </Link>
      </div>
    )
  }

  const onLeave = async () => {
    setLeaveError(null)
    try {
      await leave.mutateAsync()
      clearStoredQueueToken(garageId)
    } catch (err) {
      setLeaveError(errorMessage(err))
    }
    setConfirmLeave(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} />
        <div>
          <p className="text-sm font-medium text-slate-500">Walk-in queue</p>
          <h1 className="text-xl font-semibold text-slate-900">{garage.name}</h1>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {isLoading || !status ? (
          error ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage(error)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Loading your place…</p>
          )
        ) : (
          <StatusBody status={status} />
        )}

        {status && (status.status === 'WAITING' || status.status === 'CALLED') && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            {leaveError && (
              <p className="mb-2 text-sm text-red-600" role="alert">
                {leaveError}
              </p>
            )}
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="text-sm font-medium text-slate-500 hover:text-red-600"
            >
              Leave the queue
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        This page updates by itself. Keep it open, or come back to this link any time.
      </p>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the queue?"
        confirmLabel="Leave the queue"
        cancelLabel="Stay in the queue"
        danger
        busy={leave.isPending}
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      >
        You'll lose your place. You can join again, but you'll go to the back of the line.
      </ConfirmDialog>
    </div>
  )
}

function StatusBody({ status }: { status: PublicQueueStatus }) {
  const ticket = (
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
      Ticket {status.ticket_number} · {QUEUE_STATUS_LABELS[status.status]}
    </p>
  )

  if (status.status === 'CALLED') {
    return (
      <div role="status">
        {ticket}
        <p className="mt-2 text-2xl font-semibold text-emerald-700">It's your turn!</p>
        <p className="mt-1 text-sm text-slate-600">
          Please come to reception now, {status.customer_first_name}.
          {status.call_expires_at &&
            ` If you're not here by ${formatTime(status.call_expires_at)}, we'll move on to the next person.`}
        </p>
      </div>
    )
  }
  if (status.status === 'IN_SERVICE') {
    return (
      <div role="status">
        {ticket}
        <p className="mt-2 text-lg font-semibold text-slate-900">You're being looked after.</p>
      </div>
    )
  }
  if (status.status !== 'WAITING') {
    const message: Record<string, string> = {
      DONE: 'All done — thanks for visiting.',
      CANCELLED:
        status.end_reason === 'DAY_ENDED'
          ? "The queue closed for the day before we reached you. We're sorry — please come back or book an appointment."
          : "You've left the queue.",
      NO_SHOW: "We called you but couldn't find you, so we moved on. Please speak to reception.",
    }
    return (
      <div role="status">
        {ticket}
        <p className="mt-2 text-lg font-semibold text-slate-900">{message[status.status]}</p>
      </div>
    )
  }

  return (
    <div role="status">
      {ticket}
      <p className="mt-2 text-sm text-slate-600">Hi {status.customer_first_name}, you're in line.</p>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-slate-500">Your position</dt>
          <dd className="text-3xl font-semibold text-slate-900">{status.position}</dd>
          <dd className="text-xs text-slate-500">
            {status.people_ahead === 0
              ? "You're next"
              : `${status.people_ahead} ${status.people_ahead === 1 ? 'person' : 'people'} ahead`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Estimated wait</dt>
          <dd className="text-3xl font-semibold text-slate-900">
            {status.fits_today === false ? '—' : formatWait(status.estimated_wait_minutes)}
          </dd>
          {status.estimated_start_at && (status.estimated_wait_minutes ?? 0) > 0 && (
            <dd className="text-xs text-slate-500">around {formatTime(status.estimated_start_at)}</dd>
          )}
        </div>
      </dl>
      {status.fits_today === false && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          It's getting busy — we may not reach you before closing today. Please speak to
          reception.
        </p>
      )}
    </div>
  )
}
