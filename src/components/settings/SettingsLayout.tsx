import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'

const SECTIONS = [
  { slug: 'employees', label: 'Employees' },
  { slug: 'roles', label: 'Roles' },
  { slug: 'appointment-types', label: 'Appointment Types' },
  { slug: 'garage', label: 'Garage Details' },
]

/** Wraps a settings subsection page with a mini nav for jumping between subsections. */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const garageId = useGarageId()

  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-44 sm:flex-col">
        <Link
          to={`/${garageId}/settings`}
          className="mb-2 flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
            <path
              d="M12 15l-5-5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Link>
        {SECTIONS.map((s) => (
          <NavLink
            key={s.slug}
            to={`/${garageId}/settings/${s.slug}`}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
