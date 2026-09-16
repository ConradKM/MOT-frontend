// Support contact details for the Business Dashboard's "Need Help?" menu and
// Feedback page (business-dashboard only - never referenced from the
// customer-facing booking pages). The email is fixed platform-wide; the phone
// number is deployment-specific and may not be set yet.
export const SUPPORT_EMAIL = 'support@comaz.co.uk'

// TODO: set VITE_SUPPORT_PHONE_NUMBER (see .env.example) once a real support
// line exists. Until then this stays null and "Call Us" shows as unavailable
// rather than dialling a made-up number - see components/NeedHelpMenu.tsx.
export const SUPPORT_PHONE_NUMBER: string | null =
  (import.meta.env.VITE_SUPPORT_PHONE_NUMBER as string | undefined)?.trim() || null
