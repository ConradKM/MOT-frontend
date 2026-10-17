import { useState, type FormEvent } from 'react'
import {
  useCreateEmployee,
  useEmployees,
  useRoles,
  useUpdateEmployee,
} from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { Disclosure } from '../../components/Disclosure'
import {
  ExpandableRow,
  ExpandToggle,
  SettingsTable,
  Td,
  Th,
} from '../../components/settings/ExpandableRow'
import { InfoTip } from '../../components/settings/InfoTip'
import { SettingsPageHeader } from '../../components/settings/SettingsUI'
import { employeeDisplayName } from '../../lib/employees'
import type { Employee, Role } from '../../types'

const PAGE_SIZE = 10

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

function EditEmployeePanel({
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
  const idBase = `employee-${employee.id}`

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
    <div className="max-w-xl space-y-3">
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`${idBase}-first`}>
            First name
          </label>
          <input
            id={`${idBase}-first`}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor={`${idBase}-last`}>
            Last name
          </label>
          <input
            id={`${idBase}-last`}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idBase}-email`}>
          Email
        </label>
        <input
          id={`${idBase}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <div role="group" aria-labelledby={`${idBase}-roles`}>
        <p id={`${idBase}-roles`} className="block text-sm font-medium text-slate-700">
          Roles
        </p>
        <div className="mt-1">
          <RoleTagPicker roles={roles} selectedIds={roleIds} onToggle={toggleRole} />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="min-h-11 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ActivationToggle({ employee }: { employee: Employee }) {
  const update = useUpdateEmployee(employee.id)
  const { showToast } = useToast()

  const toggle = async () => {
    try {
      await update.mutateAsync({ is_active: !employee.is_active })
      showToast(employee.is_active ? 'Account deactivated.' : 'Account activated.', 'success')
    } catch (err) {
      showToast(
        isApiError(err) && err.code === 403
          ? 'Only the business owner can change this.'
          : errorMessage(err),
      )
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={update.isPending}
      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-slate-700 hover:underline disabled:opacity-50 sm:min-h-0 sm:py-1"
    >
      {employee.is_active ? 'Deactivate' : 'Activate'}
    </button>
  )
}

function AddEmployeeForm({ roles }: { roles: Role[] }) {
  const createMutation = useCreateEmployee()
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    if (password !== confirmPassword) {
      setErrors({ confirm_password: 'Passwords do not match.' })
      return
    }
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
      setConfirmPassword('')
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
      <p className="text-sm text-slate-500">Only business owners can add employees.</p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {forbidden && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only the business owner can add employees.
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
              required
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
              required
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
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="confirm_password"
          >
            Confirm password
          </label>
          <input
            id="confirm_password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.confirm_password && (
            <p className="mt-1 text-sm text-red-600">{errors.confirm_password}</p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1">
            <p id="new-employee-roles" className="text-sm font-medium text-slate-700">
              Roles
            </p>
            <InfoTip label="Roles">Defaults to "STAFF" if none are picked.</InfoTip>
          </div>
          <div className="mt-1" role="group" aria-labelledby="new-employee-roles">
            <RoleTagPicker roles={roles} selectedIds={roleIds} onToggle={toggleRole} />
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add Employee'}
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
    <>
      <SettingsPageHeader title="Employees" info="Everyone with an account at your business." />

      <div className="mt-6">
        {isLoading ? (
          <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
            Loading…
          </p>
        ) : employees && employees.length > 0 ? (
          <>
            <SettingsTable
              label="Employees"
              minWidth="min-w-[48rem]"
              columns={['w-1/5', undefined, 'w-1/5', 'w-28', 'w-52']}
              head={
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Roles</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              }
            >
              {visibleEmployees.map((e) => (
                <ExpandableRow
                  key={e.id}
                  colSpan={5}
                  expanded={editingId === e.id}
                  onClose={() => setEditingId(null)}
                  label={`Edit ${employeeDisplayName(e)}`}
                  summary={(toggle) => (
                    <>
                      <Td>
                        <p className="font-medium text-slate-900">{employeeDisplayName(e)}</p>
                      </Td>
                      <Td className="text-slate-700">{e.email}</Td>
                      <Td>
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
                          <span className="text-slate-500">No roles</span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {e.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-x-1">
                          <ExpandToggle
                            {...toggle}
                            onClick={() => setEditingId(editingId === e.id ? null : e.id)}
                          />
                          <ActivationToggle employee={e} />
                        </div>
                      </Td>
                    </>
                  )}
                >
                  <EditEmployeePanel
                    employee={e}
                    roles={roles ?? []}
                    onDone={() => setEditingId(null)}
                  />
                </ExpandableRow>
              ))}
            </SettingsTable>
            {hasMore && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="min-h-11 text-sm font-medium text-slate-700 hover:underline"
                >
                  Show 10 more ({(employees ?? []).length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
            No employees yet.
          </p>
        )}
      </div>

      <div className="mt-6">
        <Disclosure title="Add Employees">
          <AddEmployeeForm roles={roles ?? []} />
        </Disclosure>
      </div>
    </>
  )
}
