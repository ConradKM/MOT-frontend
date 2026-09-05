import { NavLink, Outlet } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'
import { useUnreadWhatsAppCount } from '../../api/queries'

const TABS = [
  { end: true, slug: '', label: 'Overview' },
  { end: false, slug: 'calls', label: 'Calls' },
  { end: false, slug: 'whatsapp', label: 'WhatsApp' },
  { end: false, slug: 'contact', label: 'Contact Customer' },
]

/** Shared tab bar for the Communications section - Overview/Calls/WhatsApp/
 * Contact Customer are one nav item away from the rest of the app (see
 * Layout.tsx), then switch via tabs here rather than crowding the main
 * sidebar with four more entries. */
export function CommunicationsLayout() {
  const garageId = useGarageId()
  const { data: unread } = useUnreadWhatsAppCount()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Communications</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Calls and WhatsApp messages with your customers, in one place.
      </p>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.slug}
            to={`/${garageId}/communications${tab.slug ? `/${tab.slug}` : ''}`}
            end={tab.end}
            className={({ isActive }) =>
              `relative rounded-t-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`
            }
          >
            {tab.label}
            {tab.slug === 'whatsapp' && !!unread?.whatsapp_unread && (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1 text-xs font-semibold text-white">
                {unread.whatsapp_unread}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}
