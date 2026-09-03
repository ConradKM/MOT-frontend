import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'

interface SettingsPage {
  title: string
  description: string
  slug: string
}

const SETTINGS_PAGES: SettingsPage[] = [
  {
    title: 'Appointments',
    description: 'View and manage upcoming and past appointments.',
    slug: 'appointments',
  },
  {
    title: 'Employees',
    description: 'See who has an account at your garage and add new staff.',
    slug: 'settings/employees',
  },
  {
    title: 'Roles',
    description: 'Tags you can assign to employees, like Mechanic or Front Desk.',
    slug: 'settings/roles',
  },
  {
    title: 'Appointment Types',
    description: 'The services your garage offers, their prices, and their checklists.',
    slug: 'settings/appointment-types',
  },
  {
    title: 'Appointment Statuses',
    description: 'Rename and recolour appointment statuses, or add your own.',
    slug: 'settings/appointment-statuses',
  },
  {
    title: 'Availability',
    description: 'Opening hours, slot length, booking window, and one-off closures.',
    slug: 'settings/availability',
  },
  {
    title: 'Garage Settings',
    description: "Your garage's name, contact details, and address.",
    slug: 'settings/garage',
  },
]

export function SettingsHub() {
  const garageId = useGarageId()
  const [search, setSearch] = useState('')

  const filtered = SETTINGS_PAGES.filter((p) =>
    `${p.title} ${p.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Find a settings page below.</p>

      <div className="mt-6 max-w-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search settings…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((page) => (
          <Link
            key={page.slug}
            to={`/${garageId}/${page.slug}`}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
          >
            <p className="text-sm font-semibold text-slate-900">{page.title}</p>
            <p className="mt-1 text-sm text-slate-500">{page.description}</p>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400">No settings pages match "{search}".</p>
        )}
      </div>
    </div>
  )
}
