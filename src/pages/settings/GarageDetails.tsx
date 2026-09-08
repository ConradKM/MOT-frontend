import { useEffect, useState, type FormEvent } from 'react'
import { useGarage, useUpdateGarage } from '../../api/queries'
import type { GarageDetailsPatch } from '../../api/garage'
import { BookingQrCard } from '../../components/BookingQrCard'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import type { Garage } from '../../types'

type Field = keyof GarageDetailsPatch

const FIELDS: { key: Field; label: string; type?: string; required?: boolean }[] = [
  { key: 'name', label: 'Business / trading name', required: true },
  { key: 'phone', label: 'Telephone number', type: 'tel' },
  { key: 'email', label: 'Main email address', type: 'email' },
  { key: 'address', label: 'Address' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'website', label: 'Website', type: 'url' },
]

function toForm(g: Garage): Record<Field, string> {
  return {
    name: g.name ?? '',
    phone: g.phone ?? '',
    email: g.email ?? '',
    address: g.address ?? '',
    postcode: g.postcode ?? '',
    website: g.website ?? '',
  }
}

export function GarageDetails() {
  const { data: garage, isLoading, isError } = useGarage()
  const update = useUpdateGarage()

  const [form, setForm] = useState<Record<Field, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (garage) setForm(toForm(garage))
  }, [garage])

  const set = (key: Field, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setSaved(false)
    setErrs((e) => ({ ...e, [key]: '' }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrs({})
    setSaved(false)
    if (!garage || !form) return

    if (!form.name.trim()) {
      setErrs({ name: 'A business name is required.' })
      return
    }

    // Only send fields that actually changed. An emptied optional field is a
    // real change (clears it); an emptied required field was caught above.
    const base = toForm(garage)
    const patch: GarageDetailsPatch = {}
    for (const { key } of FIELDS) {
      if (form[key].trim() !== base[key].trim()) patch[key] = form[key].trim()
    }
    if (Object.keys(patch).length === 0) {
      setError('No changes to save.')
      return
    }

    try {
      await update.mutateAsync(patch)
      setSaved(true)
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can change these details.')
      } else {
        setErrs(fieldErrors(err))
        setError(Object.keys(fieldErrors(err)).length ? null : errorMessage(err))
      }
    }
  }

  return (
    <SettingsLayout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Business details</h1>
        <p className="mt-1 text-sm text-slate-500">
          The business information we hold for you. It is used across the app and for
          customer communications. Only the business owner can change it.
        </p>

        {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {isError && (
          <p className="mt-6 text-sm text-red-600">Failed to load business details.</p>
        )}

        {garage && form && (
          <>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
              {saved && (
                <p
                  className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                  role="status"
                >
                  Business details saved.
                </p>
              )}

              {FIELDS.map(({ key, label, type, required }) => (
                <div key={key}>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor={`garage-${key}`}
                  >
                    {label}
                    {required && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    id={`garage-${key}`}
                    type={type ?? 'text'}
                    value={form[key]}
                    required={required}
                    onChange={(e) => set(key, e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  {errs[key] && <p className="mt-1 text-sm text-red-600">{errs[key]}</p>}
                </div>
              ))}

              <button
                type="submit"
                disabled={update.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <p className="mt-3 text-xs text-slate-400">
              The public booking slug and system settings are managed by the platform
              administrator and can't be changed here.
            </p>

            <BookingQrCard garageId={garage.id} />
          </>
        )}
      </div>
    </SettingsLayout>
  )
}
