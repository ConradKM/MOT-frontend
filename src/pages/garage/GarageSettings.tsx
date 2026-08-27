import { useEffect, useState, type FormEvent } from 'react'
import { useGarage, useUpdateGarage } from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'

export function GarageSettings() {
  const { data: garage, isLoading } = useGarage()
  const updateMutation = useUpdateGarage()
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (garage) {
      setName(garage.name)
      setEmail(garage.email ?? '')
      setPhone(garage.phone ?? '')
      setAddress(garage.address ?? '')
    }
  }, [garage])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    try {
      await updateMutation.mutateAsync({
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
      })
      setForbidden(false)
      showToast('Garage settings saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setForbidden(true)
        return
      }
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900">Garage settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Only garage owners can save changes here — staff accounts will see a permission error on
        submit, since there's no way to check your role ahead of time.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {forbidden && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only the garage owner can update these settings.
          </p>
        )}
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            Garage name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
