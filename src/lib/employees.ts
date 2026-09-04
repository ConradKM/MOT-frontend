import type { Employee } from '../types'

/** "Greg Mason", or the email when no name is on file - an employee is never
 * shown as a bare "—" when we know who they are. Never use this as an
 * identifier; employee.id is the only stable key. */
export function employeeDisplayName(e: Pick<Employee, 'first_name' | 'last_name' | 'email'>): string {
  const name = [e.first_name, e.last_name].filter(Boolean).join(' ').trim()
  return name || e.email
}

/** "Unassigned" for a null employee_id, otherwise the matching employee's
 * display name (or a muted placeholder while the employee list is loading /
 * the employee can't be found, e.g. it belongs to another garage). */
export function employeeNameById(
  employees: Employee[] | undefined,
  employeeId: string | null | undefined,
): string {
  if (!employeeId) return 'Unassigned'
  const found = employees?.find((e) => e.id === employeeId)
  return found ? employeeDisplayName(found) : 'Unknown employee'
}
