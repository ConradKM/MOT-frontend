import { ApiError } from '../api/client'

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** Field -> first error message, from a 422 validation response. Empty object if not a field-validation error. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!isApiError(err) || !err.fieldErrors) return {}
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(err.fieldErrors)) {
    if (messages.length > 0) out[field] = messages[0]
  }
  return out
}

export function errorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.message) return err.message
    if (err.fieldErrors) return 'Please fix the highlighted fields.'
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
