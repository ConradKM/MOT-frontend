import { Link, useParams } from 'react-router-dom'
import { useAppointmentType, useChecklistTemplate } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { isApiError } from '../../lib/errors'
import { resultOptionLabel } from '../../lib/checklist'

const mediaTypeLabels: Record<string, string> = {
  NONE: 'No media',
  PHOTO: 'Photo',
  VIDEO: 'Video',
  EITHER: 'Photo or video',
}

export function ChecklistTemplateViewer() {
  const garageId = useGarageId()
  const { appointmentTypeId } = useParams<{ appointmentTypeId: string }>()
  const { data: appointmentType } = useAppointmentType(appointmentTypeId)
  const { data: template, isLoading, isError, error } = useChecklistTemplate(appointmentTypeId)

  const notFound = isError && isApiError(error) && error.code === 404

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          to={`/${garageId}/settings/appointment-types`}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← Back to Appointment Types
        </Link>
        {!notFound && (
          <Link
            to={`/${garageId}/appointment-types/${appointmentTypeId}/checklist/build`}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            Edit
          </Link>
        )}
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Checklist for {appointmentType?.name ?? '…'}
      </h1>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {notFound && (
        <p className="mt-6 text-sm text-slate-500">
          No checklist has been set up for this appointment type yet.
        </p>
      )}

      {template && (
        <ol className="mt-6 space-y-3">
          {template.items.map((item, i) => (
            <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {i + 1}. {item.label}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  {item.visible_to_customer && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                      Customer-visible
                    </span>
                  )}
                  {item.is_compulsory && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                      Compulsory
                    </span>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="mt-1 text-xs text-slate-500">{item.description}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Results: {item.result_options.map(resultOptionLabel).join(', ')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Media: {mediaTypeLabels[item.media_type]}
                {item.media_type !== 'NONE' && item.media_required_for_statuses.length > 0 && (
                  <>
                    {' '}
                    — required when result is{' '}
                    {item.media_required_for_statuses.map(resultOptionLabel).join(', ')}
                  </>
                )}
              </p>
            </li>
          ))}
          {template.items.length === 0 && (
            <p className="text-sm text-slate-400">This checklist has no steps yet.</p>
          )}
        </ol>
      )}
    </div>
  )
}
