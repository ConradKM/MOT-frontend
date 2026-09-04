import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAppointmentChecklist,
  useAppointments,
  useStartAppointmentChecklist,
  useUpdateAppointmentChecklistItem,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'
import { resultOptionClasses, resultOptionLabel } from '../../lib/checklist'
import type { AppointmentChecklistItem, ChecklistItemStatus } from '../../types'

function ChecklistItemRow({
  item,
  appointmentId,
  checklistId,
}: {
  item: AppointmentChecklistItem
  appointmentId: string
  checklistId: string
}) {
  const updateItem = useUpdateAppointmentChecklistItem(appointmentId, checklistId)
  const { showToast } = useToast()
  const [notes, setNotes] = useState(item.notes ?? '')

  const mediaRequired =
    item.media_type !== 'NONE' && item.media_required_for_statuses.includes(item.status)

  const handleStatusChange = async (status: ChecklistItemStatus) => {
    try {
      await updateItem.mutateAsync({ itemId: item.id, data: { status } })
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handleNotesBlur = async () => {
    if (notes === (item.notes ?? '')) return
    try {
      await updateItem.mutateAsync({ itemId: item.id, data: { notes: notes || null } })
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{item.label}</p>
          {item.description && (
            <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
          )}
        </div>
        {item.is_compulsory && (
          <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
            Compulsory
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.result_options.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handleStatusChange(status)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              item.status === status
                ? `${resultOptionClasses(status)} ring-2 ring-offset-1 ring-slate-900`
                : `${resultOptionClasses(status)} opacity-50 hover:opacity-100`
            }`}
          >
            {resultOptionLabel(status)}
          </button>
        ))}
      </div>

      {mediaRequired && (
        <p className="mt-2 text-xs text-amber-700">
          {resultOptionLabel(item.status)} requires photo/video evidence on this step —
          upload isn't available yet, so this is a reminder rather than a hard block.
        </p>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesBlur}
        placeholder="Notes…"
        rows={2}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </div>
  )
}

export function AppointmentChecklistPage() {
  const garageId = useGarageId()
  const { appointmentId } = useParams<{ appointmentId: string }>()
  // No GET /api/appointments/{id} exists; find it from the already-fetched unfiltered list.
  const { data: allAppointments } = useAppointments()
  const appointment = allAppointments?.find((a) => a.id === appointmentId)

  const { data: checklist, isLoading, isError, error } = useAppointmentChecklist(appointmentId)
  const startChecklist = useStartAppointmentChecklist(appointmentId as string)
  const { showToast } = useToast()

  const notStarted = isError && isApiError(error) && error.code === 404

  const handleStart = async () => {
    try {
      await startChecklist.mutateAsync()
    } catch (err) {
      if (isApiError(err) && err.code === 422) {
        showToast('This appointment type has no checklist set up yet — ask the owner to build one.')
        return
      }
      showToast(errorMessage(err))
    }
  }

  const compulsoryItems = checklist?.items.filter((i) => i.is_compulsory) ?? []
  const compulsoryDone = compulsoryItems.filter((i) => i.status !== 'NOT_CHECKED').length

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          to={`/${garageId}/appointments/${appointmentId}/overview`}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← Back to appointment
        </Link>
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Checklist</h1>
      {appointment && (
        <p className="mt-1 text-sm text-slate-500">
          {new Date(appointment.start_time).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {notStarted && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm text-slate-600">This appointment's checklist hasn't been started yet.</p>
          <button
            type="button"
            onClick={handleStart}
            disabled={startChecklist.isPending}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {startChecklist.isPending ? 'Starting…' : 'Start checklist'}
          </button>
        </div>
      )}

      {checklist && (
        <>
          {compulsoryItems.length > 0 && (
            <p className="mt-4 text-sm font-medium text-slate-700">
              {compulsoryDone} of {compulsoryItems.length} compulsory items complete
            </p>
          )}

          <div className="mt-4 space-y-3">
            {checklist.items.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                appointmentId={appointmentId as string}
                checklistId={checklist.id}
              />
            ))}
            {checklist.items.length === 0 && (
              <p className="text-sm text-slate-400">This checklist has no steps.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
