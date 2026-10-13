import { FLAG_LABEL, formatWhen } from '../../lib/importDisplay'
import type { AppointmentNormalised, ImportItem } from '../../types'
import { IssueList, ItemStatusBadge, WarningBadge } from './parts'

/** One previewed appointment row: when, what, who, and what is wrong with it.
 * Shared by the list view and the calendar's detail panel. */

export function AppointmentCard({ item }: { item: ImportItem }) {
  const appointment = item.normalised as AppointmentNormalised
  const customer = appointment.customer
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Row {item.index + 1}</span>
        <ItemStatusBadge status={item.status} />
        <WarningBadge count={item.warnings.length} />
        {(appointment.flags ?? []).map((flag) => (
          <span
            key={flag}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs whitespace-nowrap text-slate-700"
          >
            {FLAG_LABEL[flag]}
          </span>
        ))}
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="sr-only">When</dt>
          <dd className="font-medium text-slate-900">{formatWhen(appointment)}</dd>
        </div>
        <div>
          <dt className="sr-only">Service</dt>
          <dd className="text-slate-800">
            {appointment.service ?? 'Service not matched'}
            {appointment.status && appointment.status !== 'BOOKED' ? ` · ${appointment.status}` : ''}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Customer</dt>
          <dd className="text-slate-800">
            {customer ? `${customer.first_name} ${customer.last_name}` : 'No customer'}
            {customer?.match === 'existing' ? (
              <span className="block text-xs text-slate-500">
                Existing customer{customer.existing_name ? ` (${customer.existing_name})` : ''}
              </span>
            ) : customer?.match === 'earlier_row' ? (
              <span className="block text-xs text-slate-500">
                Same new customer as row {(customer.same_as_index ?? 0) + 1}
              </span>
            ) : customer?.match === 'new' ? (
              <span className="block text-xs text-slate-500">New customer</span>
            ) : null}
            {customer && (customer.phone || customer.email) ? (
              <span className="block text-xs break-all text-slate-500">
                {[customer.phone, customer.email].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="sr-only">With</dt>
          <dd className="text-slate-800">
            {appointment.employee ? `With ${appointment.employee.name ?? appointment.employee.email}` : ''}
          </dd>
        </div>
        {appointment.notes ? (
          <div className="sm:col-span-2">
            <dt className="sr-only">Notes</dt>
            <dd className="text-xs text-slate-600">{appointment.notes}</dd>
          </div>
        ) : null}
        {appointment.duplicate_of !== undefined ? (
          <div className="sm:col-span-2">
            <dd className="text-xs text-slate-600">
              Duplicate of row {appointment.duplicate_of + 1}; skipped.
            </dd>
          </div>
        ) : null}
      </dl>
      <IssueList errors={item.errors} warnings={item.warnings} />
    </div>
  )
}
