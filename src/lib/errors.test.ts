import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { errorMessage, fieldErrors, isApiError } from './errors'

const validationError = () =>
  new ApiError(
    {
      code: 422,
      status: 'Unprocessable Entity',
      errors: { json: { email: ['Not a valid email.', 'Also too long.'], phone: [] } },
    },
    'fallback',
  )

describe('isApiError', () => {
  it('distinguishes an ApiError from any other thrown value', () => {
    expect(isApiError(validationError())).toBe(true)
    expect(isApiError(new Error('boom'))).toBe(false)
    expect(isApiError('boom')).toBe(false)
    expect(isApiError(null)).toBe(false)
  })
})

describe('fieldErrors', () => {
  it('maps each field to its first message', () => {
    // Forms render one message per field, so only the first is surfaced.
    expect(fieldErrors(validationError())).toEqual({ email: 'Not a valid email.' })
  })

  it('reads query-parameter validation errors too', () => {
    const err = new ApiError(
      { code: 422, status: 'x', errors: { query: { search: ['Too short.'] } } },
      'fallback',
    )
    expect(fieldErrors(err)).toEqual({ search: 'Too short.' })
  })

  it('returns nothing for an error that carries no field detail', () => {
    expect(fieldErrors(new ApiError({ code: 500, status: 'x' }, 'fallback'))).toEqual({})
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })
})

describe('errorMessage', () => {
  it('prefers the server’s message', () => {
    const err = new ApiError({ code: 409, status: 'Conflict', message: 'Slot taken.' }, 'fallback')
    expect(errorMessage(err)).toBe('Slot taken.')
  })

  it('accepts flask-jwt-extended’s "msg" key', () => {
    // Raw JWT errors use `msg`; without this the user would see the fallback.
    const err = new ApiError({ code: 401, status: 'Unauthorized', msg: 'Token expired' }, 'fb')
    expect(errorMessage(err)).toBe('Token expired')
  })

  it('points at the highlighted fields when a 422 has no top-level message', () => {
    const err = validationError()
    err.message = ''
    expect(errorMessage(err)).toBe('Please fix the highlighted fields.')
  })

  it('passes through a plain Error’s message', () => {
    expect(errorMessage(new Error('Network request failed'))).toBe('Network request failed')
  })

  it('never leaks a non-Error value to the user', () => {
    expect(errorMessage('some string')).toBe('Something went wrong.')
    expect(errorMessage(undefined)).toBe('Something went wrong.')
    expect(errorMessage({ weird: true })).toBe('Something went wrong.')
  })
})
