import { Link } from 'react-router-dom'
import { useAppointmentTypes, useChecklistTemplate } from '../../api/queries'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { useGarageId } from '../../hooks/useGarageId'
import type { AppointmentType } from '../../types'

const typeStatusClasses: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  HIDDEN: 'bg-slate-100 text-slate-500',
  DEPRECATED: 'bg-amber-100 text-amber-700',
}

function AppointmentTypeRow({ type }: { type: AppointmentType }) {
  const garageId = useGarageId()
  const { data: template, isLoading } = useChecklistTemplate(type.id)
  const hasTemplate = !!template

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2">
        <p className="font-medium text-slate-900">{type.name}</p>
        {type.description && <p className="text-xs text-slate-500">{type.description}</p>}
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeStatusClasses[type.status]}`}
        >
          {type.status}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        {isLoading ? (
          <span className="text-sm text-slate-400">Loading…</span>
        ) : (
          <div className="flex justify-end gap-3 text-sm font-medium">
            {hasTemplate && (
              <Link
                to={`/${garageId}/appointment-types/${type.id}/checklist`}
                className="text-slate-600 hover:underline"
              >
                View checklist
              </Link>
            )}
            <Link
              to={`/${garageId}/appointment-types/${type.id}/checklist/build`}
              className="text-slate-900 hover:underline"
            >
              {hasTemplate ? 'Edit checklist' : 'Build checklist'}
            </Link>
          </div>
        )}
      </td>
    </tr>
  )
}

export function AppointmentTypesList() {
  const { data: types, isLoading } = useAppointmentTypes()

  return (
    <SettingsLayout>
      <h1 className="text-2xl font-semibold text-slate-900">Appointment Types</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each type can have one checklist that mechanics work through during that kind of
        appointment.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : types && types.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <AppointmentTypeRow key={type.id} type={type} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">No appointment types yet.</p>
        )}
      </div>
    </SettingsLayout>
  )
}
