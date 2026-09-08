import { useGarage } from '../../api/queries'
import { BookingQrCard } from '../../components/BookingQrCard'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import type { Garage } from '../../types'

const FIELDS: { label: string; get: (g: Garage) => string | null }[] = [
  { label: 'Business / trading name', get: (g) => g.name },
  { label: 'Telephone number', get: (g) => g.phone },
  { label: 'Main email address', get: (g) => g.email },
  { label: 'Address', get: (g) => g.address },
  { label: 'Postcode', get: (g) => g.postcode },
  { label: 'Website', get: (g) => g.website },
]

export function GarageDetails() {
  const { data: garage, isLoading, isError } = useGarage()

  return (
    <SettingsLayout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Business details</h1>
        <p className="mt-1 text-sm text-slate-500">
          The business information we hold for you. It is used across the app and for
          customer communications.
        </p>

        {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {isError && (
          <p className="mt-6 text-sm text-red-600">Failed to load business details.</p>
        )}

        {garage && (
          <>
            <dl className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {FIELDS.map(({ label, get }) => {
                const value = get(garage)
                return (
                  <div
                    key={label}
                    className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-slate-500">{label}</dt>
                    <dd className="text-sm text-slate-900 sm:col-span-2">
                      {value ? value : <span className="text-slate-400">Not set</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>

            <p className="mt-3 text-xs text-slate-400">
              If any of these business details are incorrect or need updating, please contact
              the platform administrator.
            </p>

            <BookingQrCard garageId={garage.id} />
          </>
        )}
      </div>
    </SettingsLayout>
  )
}
