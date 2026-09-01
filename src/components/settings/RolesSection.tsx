import { useState, type FormEvent } from 'react'
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '../../api/queries'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../Toast'

const PROTECTED_ROLE_NAMES = new Set(['OWNER'])

/** Roles management (list/add/rename/delete) — lives inside a Disclosure on the
 * Employees page rather than its own route, since roles only exist to tag employees. */
export function RolesSection() {
  const { data: roles, isLoading } = useRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()
  const { showToast } = useToast()

  const [newRoleName, setNewRoleName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    try {
      await createMutation.mutateAsync(newRoleName)
      setNewRoleName('')
      showToast('Role added.', 'success')
    } catch (err) {
      setCreateError(errorMessage(err))
    }
  }

  const startEditing = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleRename = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, name: editingName })
      setEditingId(null)
      showToast('Role renamed.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete the "${name}" role? It will be removed from any employees that have it.`))
      return
    try {
      await deleteMutation.mutateAsync(id)
      showToast('Role deleted.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-500">
        Tags you can assign to employees. "OWNER" is protected — every garage has one and it
        can't be renamed or deleted.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {roles && roles.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No roles yet.</p>
        )}
        {roles && roles.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {roles.map((role) => {
              const protectedRole = PROTECTED_ROLE_NAMES.has(role.name)
              const editing = editingId === role.id
              return (
                <li key={role.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  {editing ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(role.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                      {role.name}
                    </span>
                  )}

                  <div className="flex shrink-0 gap-3 text-sm font-medium">
                    {editing ? (
                      <>
                        <button
                          onClick={() => handleRename(role.id)}
                          className="text-slate-900 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(role.id, role.name)}
                          disabled={protectedRole}
                          className="text-slate-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(role.id, role.name)}
                          disabled={protectedRole}
                          className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex max-w-sm items-start gap-2">
        <div className="flex-1">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="New role name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {createError && <p className="mt-1 text-sm text-red-600">{createError}</p>}
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !newRoleName.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  )
}
