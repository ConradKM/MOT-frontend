import {
  Bell,
  BellRing,
  Building2,
  Car,
  ChevronLeft,
  CircleDot,
  Clock,
  ListOrdered,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'

export interface SettingsSection {
  /** Bold muted-caps header above the items; null for a flat, headerless item. */
  group: string | null
  /** `slug` is the path under /:garageId/settings/. */
  items: { slug: string; label: string; icon: LucideIcon }[]
}

/** The single source of truth for every settings page. The routes in App.tsx
 * nest under this layout, so a page listed here always gets the sidebar -
 * there is no per-page wrapper to forget. */
export const SECTIONS: SettingsSection[] = [
  { group: null, items: [{ slug: 'garage-details', label: 'Business Details', icon: Building2 }] },
  { group: null, items: [{ slug: 'availability', label: 'Availability', icon: Clock }] },
  {
    group: 'Appointments',
    items: [
      { slug: 'appointment-types', label: 'Appointment Types', icon: Tags },
      { slug: 'appointment-statuses', label: 'Appointment Statuses', icon: CircleDot },
      { slug: 'booking-workflow', label: 'Booking Workflow', icon: Workflow },
    ],
  },
  {
    group: 'Reminders',
    items: [
      { slug: 'reminders', label: 'Appointment Reminders', icon: BellRing },
      { slug: 'reminders/customer', label: 'Customer & Sale Reminders', icon: Bell },
      { slug: 'reminders/mot', label: 'MOT Reminders', icon: Car },
    ],
  },
  {
    group: 'Access',
    items: [
      { slug: 'employees', label: 'Employees', icon: Users },
      { slug: 'roles', label: 'Roles', icon: ShieldCheck },
    ],
  },
  {
    group: 'Operations',
    items: [
      { slug: 'communications-automation', label: 'Communications Automation', icon: MessageSquare },
      { slug: 'payments', label: 'Payments', icon: CreditCard },
      { slug: 'walk-in-queue', label: 'Walk-in Queue', icon: ListOrdered },
    ],
  },
]

/** Route shell for /:garageId/settings/* - a GitHub-style grouped sidebar
 * beside the active settings page. */
export function SettingsLayout() {
  const garageId = useGarageId()

  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <nav
        aria-label="Settings"
        className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto sm:w-52 sm:flex-col sm:items-stretch"
      >
        <Link
          to={`/${garageId}/dashboard`}
          className="mb-2 flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        {SECTIONS.map((section, i) => (
          <div
            key={section.group ?? section.items[0].slug}
            className={`flex shrink-0 flex-row items-center gap-1 sm:flex-col sm:items-stretch ${
              section.group && i > 0 ? 'sm:mt-3 sm:border-t sm:border-slate-200 sm:pt-3' : ''
            }`}
          >
            {section.group && (
              <h2 className="whitespace-nowrap px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {section.group}
              </h2>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.slug}
                to={`/${garageId}/settings/${item.slug}`}
                // Appointment Reminders lives at the Reminders group's own
                // index, so it must not stay lit on the group's sibling pages.
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-[13px] ${
                    isActive
                      ? 'bg-slate-900 font-medium text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
