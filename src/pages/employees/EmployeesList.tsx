import { useState, type FormEvent } from 'react'
import {
  useCreateEmployee,
  useEmployees,
  useRoles,
  useUpdateEmployee,
} from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { RolesSection } from '../../components/settings/RolesSection'
import { Disclosure } from '../../components/Disclosure'
import { formatDateTime } from '../../lib/datetime'
import type { Employee, Role } from '../../types'

const PAGE_SIZE = 10

function employeeName(e: Employee): string {
  return [e.first_name, e.last_name].filter(Boolean).join(' ')
}

function RoleTagPicker({
  roles,
  selectedIds,
  onToggle,
}: {
  roles: Role[]
  selectedIds: string[]
  onToggle: (roleId: string) => void
}) {
  if (roles.length === 0) {
    return <p className="text-sm text-slate-400">No roles set up yet.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => {
        const selected = selectedIds.includes(role.id)
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onToggle(role.id)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              selected
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {role.name}
          </button>
        )
      })}
    </div>
  )
}

function EditEmployeeRow({
  employee,
  roles,
  onDone,
}: {
  employee: Employee
  roles: Role[]
  onDone: () => void
}) {
  const updateMutation = useUpdateEmployee(employee.id)
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState(employee.first_name ?? '')
  const [lastName, setLastName] = useState(employee.last_name ?? '')
  const [email, setEmail] = useState(employee.email)
  const [roleIds, setRoleIds] = useState(employee.roles.map((r) => r.id))
  const [formError, setFormError] = useState<string | null>(null)

  const toggleRole = (roleId: string) => {
    setRoleIds((ids) => (ids.includes(roleId) ? ids.filter((id) => id !== roleId) : [...ids, roleId]))
  }

  const handleSave = async () => {
    setFormError(null)
    try {
      await updateMutation.mutateAsync({
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        role_ids: roleIds,
      })
      showToast('Employee updated.', 'success')
      onDone()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
      <td colSpan={5} className="px-4 py-4">
        <div className="space-y-3">
          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Roles</label>
            <div className="mt-1">
              <RoleTagPicker roles={roles} selectedIds={roleIds} onToggle={toggleRole} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function AddEmployeeForm({ roles }: { roles: Role[] }) {
  const createMutation = useCreateEmployee()
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const toggleRole = (roleId: string) => {
    setRoleIds((ids) => (ids.includes(roleId) ? ids.filter((id) => id !== roleId) : [...ids, roleId]))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    setForbidden(false)
    try {
      await createMutation.mutateAsync({
        email,
        password,
        first_name: firstName || null,
        last_name: lastName || null,
        role_ids: roleIds,
      })
      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setRoleIds([])
      showToast('Employee added.', 'success')
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

  return (
    <div className="max-w-md">
      <p className="text-sm text-slate-500">Only garage owners can add employees.</p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {forbidden && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only the garage owner can add employees.
          </p>
        )}
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
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="last_name">
              Last name
            </label>
            <input
              id="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Roles</label>
          <div className="mt-1">
            <RoleTagPicker roles={roles} selectedIds={roleIds} onToggle={toggleRole} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Defaults to "STAFF" if none are picked.</p>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add employee'}
        </button>
      </form>
    </div>
  )
}

export function EmployeesList() {
  const { data: employees, isLoading } = useEmployees()
  const { data: roles } = useRoles()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingId, setEditingId] = useState<string | null>(null)

  const visibleEmployees = (employees ?? []).slice(0, visibleCount)
  const hasMore = (employees ?? []).length > visibleCount

  return (
    <SettingsLayout>
      <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
      <p className="mt-1 text-sm text-slate-500">Everyone with an account at your garage.</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : employees && employees.length > 0 ? (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Added</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((e) =>
                  editingId === e.id ? (
                    <EditEmployeeRow
                      key={e.id}
                      employee={e}
                      roles={roles ?? []}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-900">{employeeName(e) || '—'}</p>
                        <p className="text-xs text-slate-400">{e.id}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{e.email}</td>
                      <td className="px-4 py-2">
                        {e.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.roles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">No roles</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{formatDateTime(e.created_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setEditingId(e.id)}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {hasMore && (
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="text-sm font-medium text-slate-600 hover:underline"
                >
                  Show 10 more ({(employees ?? []).length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">No employees yet.</p>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <Disclosure title="Add employee">
          <AddEmployeeForm roles={roles ?? []} />
        </Disclosure>
        <Disclosure title="Roles">
          <RolesSection />
        </Disclosure>
      </div>
    </SettingsLayout>
  )
}
