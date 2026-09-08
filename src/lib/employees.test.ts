import { describe, expect, it } from 'vitest'
import { employeeDisplayName, employeeNameById } from './employees'
import { makeEmployee } from '../test/fixtures'

describe('employeeDisplayName', () => {
  it('uses the full name when both parts are on file', () => {
    expect(employeeDisplayName({ first_name: 'Greg', last_name: 'Mason', email: 'g@x.com' })).toBe(
      'Greg Mason',
    )
  })

  it('falls back to the email rather than showing a blank or partial name', () => {
    expect(employeeDisplayName({ first_name: null, last_name: null, email: 'g@x.com' })).toBe(
      'g@x.com',
    )
  })

  it('uses whichever single name part exists', () => {
    expect(employeeDisplayName({ first_name: 'Greg', last_name: null, email: 'g@x.com' })).toBe(
      'Greg',
    )
    expect(employeeDisplayName({ first_name: null, last_name: 'Mason', email: 'g@x.com' })).toBe(
      'Mason',
    )
  })

  it('falls back to the email when the names are only whitespace', () => {
    expect(employeeDisplayName({ first_name: ' ', last_name: ' ', email: 'g@x.com' })).toBe(
      'g@x.com',
    )
  })
})

describe('employeeNameById', () => {
  const employees = [makeEmployee({ id: 'e1', first_name: 'Greg', last_name: 'Mason' })]

  it('says "Unassigned" for a null employee id', () => {
    expect(employeeNameById(employees, null)).toBe('Unassigned')
    expect(employeeNameById(employees, undefined)).toBe('Unassigned')
    expect(employeeNameById(employees, '')).toBe('Unassigned')
  })

  it('resolves a known employee to their display name', () => {
    expect(employeeNameById(employees, 'e1')).toBe('Greg Mason')
  })

  it('degrades to a placeholder instead of crashing on an unknown id', () => {
    // Happens for an employee from another garage, or while the list loads.
    expect(employeeNameById(employees, 'e-missing')).toBe('Unknown employee')
    expect(employeeNameById(undefined, 'e1')).toBe('Unknown employee')
  })
})
