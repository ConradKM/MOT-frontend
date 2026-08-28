import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from '../../api/queries'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { useToast } from '../../components/Toast'

export function CustomerForm() {
  const { id: customerId } = useParams()
  const isEdit = customerId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: existing } = useCustomer(customerId)
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer(customerId ?? '')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setFirstName(existing.first_name)
      setLastName(existing.last_name)
      setEmail(existing.email ?? '')
      setPhone(existing.phone ?? '')
    }
  }, [existing])

  const submitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
    }
    try {
      if (isEdit) {
        const updated = await updateMutation.mutateAsync(payload)
        navigate(`/customers/${updated.id}`)
      } else {
        const created = await createMutation.mutateAsync(payload)
        showToast('Customer created.', 'success')
        navigate(`/customers/${created.id}`)
      }
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900">
        {isEdit ? 'Edit customer' : 'New customer'}
      </h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="first_name">
              First name
            </label>
            <input
              id="first_name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="last_name">
              Last name
            </label>
            <input
              id="last_name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>}
          </div>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
