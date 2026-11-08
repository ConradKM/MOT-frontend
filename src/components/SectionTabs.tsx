import { NavLink } from 'react-router-dom'

export interface SectionTab {
  to: string
  label: string
  /** Match only the exact path - for the section's index tab. */
  end?: boolean
  badge?: number
}

/** The tab bar under one top-menu item (same look as CommunicationsLayout's),
 * for sections that merge several pages behind a single nav entry. */
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `relative inline-flex min-h-11 items-center whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
              isActive
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          {tab.label}
          {!!tab.badge && (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1 text-xs font-semibold text-white">
              {tab.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
