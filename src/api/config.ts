// Base URL prepended to every API request. Empty in local dev, where Vite's
// dev server proxies /api to the backend (see vite.config.ts) so the browser
// only ever talks to the Vite origin. Set via VITE_API_BASE_URL for a build
// that talks to a deployed backend directly (no proxy in a static build).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
