import { apiFetch } from './client'
import { API_BASE_URL } from './config'

/**
 * The three-step presigned image upload, for services and service groups.
 *
 * The app never streams the bytes: it asks for a ticket, the browser PUTs
 * straight to object storage, and only then does the server confirm what
 * actually landed and attach it. That last step is not a formality - the
 * declared content type and the filename are both just claims from a client
 * that is about to write into a bucket, so the server sniffs the real magic
 * bytes before it will point a row at them.
 *
 * `apiFetch` is JSON-only (see client.ts), so the PUT goes through plain
 * fetch - it is also cross-origin to the bucket and must not carry our
 * Authorization header.
 */

export interface UploadTicket {
  storage_key: string
  upload_url: string
  expires_in: number
}

/** PNG, JPEG and WebP only - deliberately narrower than checklist evidence.
 * Enforced again server-side against the real bytes. */
export const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export function isSupportedImage(file: File): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)
}

/**
 * Upload `file` and attach it to whatever `basePath` addresses (a service or
 * a group), returning that resource in its updated form.
 *
 * `basePath` is the resource's own image endpoint, e.g.
 * `/api/appointment-types/<id>/image`.
 */
export async function uploadImage<T>(basePath: string, file: File): Promise<T> {
  const ticket = await apiFetch<UploadTicket>(basePath, {
    method: 'POST',
    body: { content_type: file.type, size_bytes: file.size },
  })

  const put = await fetch(ticket.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!put.ok) {
    throw new Error('The image could not be uploaded. Please try again.')
  }

  return apiFetch<T>(basePath, { method: 'PUT', body: { storage_key: ticket.storage_key } })
}

export function deleteImage<T>(basePath: string): Promise<T> {
  return apiFetch<T>(basePath, { method: 'DELETE' })
}

/** Exported for tests, which need to know where the PUT would have gone. */
export const uploadBaseUrl = API_BASE_URL
