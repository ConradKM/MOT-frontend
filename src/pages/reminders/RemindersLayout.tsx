import { NavLink, Outlet } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'

const TABS = [
  { end: true, slug: '', label: 'Appointment Reminders' },
  { end: false, slug: 'customer', label: 'Customer / Sale Reminders' },
]

/** Single "Reminders" nav entry, switching between reminder types via tabs -
 * mirrors CommunicationsLayout. Appointment Reminders (before a booked
 * appointment) applies to any business. Customer / Sale Reminders is the
 * generic "follow up with a customer by some due date/event" concept -
 * MOT expiry is its only implemented use case today (an automotive
 * business), with service-due, renewals, post-sale follow-up etc. as
 * future additions under the same tab - so this tab is never named after
 * MOT itself. */
export function RemindersLayout() {
  const garageId = useGarageId()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reminders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Automatic messages your business sends customers, and when they go out.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.slug}
            to={`/${garageId}/reminders${tab.slug ? `/${tab.slug}` : ''}`}
            end={tab.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}
