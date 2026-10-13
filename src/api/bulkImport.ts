import { apiFetch } from './client'
import type { ImportFormats, ImportResult } from '../types'

/**
 * Bulk import from pasted JSON - many services, or an existing diary.
 *
 * Owner only, and the business always comes from the signed-in account,
 * never the payload. The server (MOT-backend `app/bulk_import`) is the single
 * authority on what is valid: these calls send the pasted JSON as-is and the
 * UI renders the per-row result.
 */

/** The example, JSON Schema and AI prompt template for each import - the
 * same text Platform Admin shows. */
export function getImportFormats(): Promise<ImportFormats> {
  return apiFetch<ImportFormats>('/api/bulk-import/formats')
}

export interface BulkImportOptions {
  /** Preview: the identical import runs and is rolled back. */
  dryRun: boolean
  /** "Import anyway" for rows with warnings. */
  acknowledgeWarnings?: boolean
}

function body(payload: unknown, { dryRun, acknowledgeWarnings = false }: BulkImportOptions) {
  return { payload, dry_run: dryRun, acknowledge_warnings: acknowledgeWarnings }
}

/** A commit with errors is refused (422), as is one with unacknowledged
 * warnings (409) - both carry the full result in the error's `body`. */
export function bulkImportAppointmentTypes(
  payload: unknown,
  options: BulkImportOptions,
): Promise<ImportResult> {
  return apiFetch<ImportResult>('/api/appointment-types/bulk', {
    method: 'POST',
    body: body(payload, options),
  })
}

export function bulkImportAppointments(
  payload: unknown,
  options: BulkImportOptions,
): Promise<ImportResult> {
  return apiFetch<ImportResult>('/api/appointments/bulk', {
    method: 'POST',
    body: body(payload, options),
  })
}
