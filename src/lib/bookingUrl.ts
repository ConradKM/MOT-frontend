/**
 * The public customer-booking URL for a business.
 *
 * The frontend route is `/book/:garageId` and it resolves the business by its
 * UUID (`GET /api/public/garages/<uuid>`), so that is what the URL — and the QR
 * code built from it — encodes. The UUID is immutable, so the link keeps
 * working across frontend deployments and is unaffected by the business's
 * (developer-only, immutable) public slug.
 *
 * The base is fixed to the production app by default so a QR code shown to a
 * business is scannable by a member of the public regardless of which origin
 * the admin happens to be viewing it from. Override with VITE_BOOKING_BASE_URL
 * (no trailing slash) for a staging deployment.
 */
export const BOOKING_BASE_URL = (
  (import.meta.env.VITE_BOOKING_BASE_URL as string | undefined) ?? 'https://app.comaz.co.uk'
).replace(/\/$/, '')

export function bookingUrl(garageId: string): string {
  return `${BOOKING_BASE_URL}/book/${garageId}`
}

/**
 * A booking link that lands the customer straight on one service's date step,
 * skipping the "what are you booking?" choice.
 *
 * The point of this is a button on the business's own website: "Book an MOT"
 * should not drop the customer on a menu they have already chosen from.
 */
export function bookingUrlForService(garageId: string, appointmentTypeId: string): string {
  return `${bookingUrl(garageId)}?service=${encodeURIComponent(appointmentTypeId)}`
}

/**
 * A booking link narrowed to one group.
 *
 * Deliberately weaker than the per-service link: a group with several services
 * still leaves the customer a real choice to make, so the wizard only
 * auto-advances when the group holds exactly one.
 */
export function bookingUrlForGroup(garageId: string, groupId: string): string {
  return `${bookingUrl(garageId)}?group=${encodeURIComponent(groupId)}`
}

/**
 * The public walk-in queue page for a business - what its queue QR code
 * encodes. Same stable, UUID-based shape (and base) as {@link bookingUrl}.
 */
export function queueUrl(garageId: string): string {
  return `${BOOKING_BASE_URL}/queue/${garageId}`
}

/**
 * A walk-in's own live status page. The token rides in the URL *fragment*,
 * which the browser never sends to any server, so it can't end up in an
 * access log - the page posts it in a request body instead. Must match the
 * link MOT-backend texts (app/communications/sms_automation.py).
 */
export function queueStatusPath(garageId: string, token: string): string {
  return `/queue/${garageId}/status#${token}`
}

/**
 * The public Terms & Conditions page for a business - what the Settings page
 * offers to paste into the business's own website. With `version`, the page
 * for one exact wording, which is what booking confirmations link to (must
 * match app/terms/service.py::terms_url in MOT-backend).
 */
export function termsUrl(garageId: string, version?: number): string {
  return `${BOOKING_BASE_URL}${termsPath(garageId, version)}`
}

export function termsPath(garageId: string, version?: number): string {
  return version != null ? `/terms/${garageId}/v/${version}` : `/terms/${garageId}`
}
