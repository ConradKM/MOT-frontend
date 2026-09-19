import type { AnswerMap } from '../components/customer/BookingFieldInput'

/** Sessionstorage-backed draft of an in-progress public booking, keyed per
 * business so refreshing the page (or briefly navigating away) doesn't force
 * a customer through Service/Date/Details again - see BookingWizard.tsx.
 *
 * Deliberately holds only what's safe to keep lying around in the browser:
 * the service/date/time picked and whatever the customer has typed about
 * themselves and their vehicle. Never a captcha token (short-lived, and
 * re-verifying on restore is correct anyway) and never anything from a paid
 * DepositIntentCreated response - that carries the payment provider's own
 * client secret (see DepositStep.tsx), which must not touch storage at all.
 * `paymentAttemptId` is safe to keep: it's a client-generated random id with
 * no payment data in it, and keeping it is what lets a restored session
 * resume the same deposit hold instead of stacking a second one alongside it
 * (see app/public_booking/routes.py::_existing_deposit_attempt).
 *
 * sessionStorage, not localStorage: a booking draft is a "came back from a
 * refresh/misclick just now" convenience, not something that should still be
 * sitting there weeks later in a shared/public computer's browser profile.
 */
export interface BookingDraft {
  step: string
  appointmentTypeId: string
  date: string
  time: string
  firstName: string
  lastName: string
  email: string
  phone: string
  paymentAttemptId: string
  answers: AnswerMap
}

const DRAFT_VERSION = 1

interface StoredDraft extends BookingDraft {
  version: number
}

function storageKey(garageId: string): string {
  return `comaz:booking-draft:${garageId}`
}

/** Whichever business's draft this is for - `garageId` is the URL param
 * (BookingWizard's `urlGarageId`), never the slug, so a draft never survives
 * a business renaming its own slug and never leaks across two different
 * businesses' booking routes even if a slug were ever reused. */
export function loadBookingDraft(garageId: string): BookingDraft | null {
  if (!garageId) return null
  try {
    const raw = sessionStorage.getItem(storageKey(garageId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    if (parsed.version !== DRAFT_VERSION) return null
    return {
      step: parsed.step ?? 'service',
      appointmentTypeId: parsed.appointmentTypeId ?? '',
      date: parsed.date ?? '',
      time: parsed.time ?? '',
      firstName: parsed.firstName ?? '',
      lastName: parsed.lastName ?? '',
      email: parsed.email ?? '',
      phone: parsed.phone ?? '',
      paymentAttemptId: parsed.paymentAttemptId ?? '',
      answers: parsed.answers ?? {},
    }
  } catch {
    // Storage disabled/unavailable (private browsing, quota, corrupted JSON)
    // - the booking still works, it just starts fresh.
    return null
  }
}

export function saveBookingDraft(garageId: string, draft: BookingDraft): void {
  if (!garageId) return
  try {
    const stored: StoredDraft = { ...draft, version: DRAFT_VERSION }
    sessionStorage.setItem(storageKey(garageId), JSON.stringify(stored))
  } catch {
    // Never let a storage failure break the booking flow itself.
  }
}

export function clearBookingDraft(garageId: string): void {
  if (!garageId) return
  try {
    sessionStorage.removeItem(storageKey(garageId))
  } catch {
    // ignore
  }
}
