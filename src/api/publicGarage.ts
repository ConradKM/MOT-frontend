import { apiFetch } from './client'

export interface PublicGarage {
  id: string
  name: string
}

// No public/unauthenticated garage endpoints exist on the backend yet (see
// MOT-frontend/README.md, "Known gap: public booking API"). These are built against the
// paths the backend is expected to add, so the booking wizard and landing page are ready
// once they exist; until then, callers see the request fail and should show a fallback.
export function getPublicGarages(): Promise<PublicGarage[]> {
  // Trailing slash is required: the backend only registers `/api/public/garages/`,
  // so the slash-less path 308-redirects to an absolute backend-origin URL that the
  // browser then follows straight past the dev proxy and gets CORS-blocked. See #9.
  return apiFetch<PublicGarage[]>('/api/public/garages/', { skipAuth: true })
}

export function getPublicGarage(id: string): Promise<PublicGarage> {
  return apiFetch<PublicGarage>(`/api/public/garages/${id}`, { skipAuth: true })
}
