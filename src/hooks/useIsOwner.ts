import { useEmployees } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { isOwner } from '../lib/employees'

/** Whether the signed-in employee is an OWNER - for showing owner-only
 * actions. False until the employee list has loaded, so an owner-only
 * control never flashes at someone who can't use it. The API is the real
 * gate either way. */
export function useIsOwner(): boolean {
  const { employeeId } = useAuth()
  const { data: employees } = useEmployees()
  return isOwner(employees?.find((e) => e.id === employeeId))
}
