import { NavLink, Outlet } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'
import { useAttentionQueue, useUnreadWhatsAppCount } from '../../api/queries'

const TABS = [
  { end: true, slug: '', label: 'Overview' },
  { end: false, slug: 'calls', label: 'Calls' },
  { end: false, slug: 'whatsapp', label: 'WhatsApp' },
  { end: false, slug: 'attention', label: 'Needs Attention' },
  { end: false, slug: 'callbacks', label: 'Callbacks' },
  { end: false, slug: 'contact', label: 'Contact Customer' },
  // Development tool only - see App.tsx, which doesn't even register this
  // route in a production build, and the backend's own
  // CONVERSATION_SIMULATOR_ENABLED gate as a second line of defence.
  ...(import.meta.env.DEV ? [{ end: false, slug: 'simulator', label: 'Simulator' }] : []),
]

/** Shared tab bar for the Communications section - one nav item away from
 * the rest of the app (see Layout.tsx), then switch via tabs here rather
 * than crowding the main sidebar with more entries. */
export function CommunicationsLayout() {
  const garageId = useGarageId()
  const { data: unread } = useUnreadWhatsAppCount()
  const { data: attentionQueue } = useAttentionQueue()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Communications</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Calls and WhatsApp messages with your customers, in one place.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.slug}
            to={`/${garageId}/communications${tab.slug ? `/${tab.slug}` : ''}`}
            end={tab.end}
            className={({ isActive }) =>
              `relative whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
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
            {tab.slug === 'attention' && !!attentionQueue?.items.length && (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-semibold text-white">
                {attentionQueue.items.length}
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
