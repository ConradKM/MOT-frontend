import { MotRemindersList } from '../motReminders/MotRemindersList'

/** Customer / Sale Reminders is the generic "follow up with a customer by
 * some due date/event" concept - MOT expiry is the only reminder this kind
 * currently sends, and only for automotive businesses. Service-due,
 * renewals, post-sale follow-up, recurring maintenance and re-engagement
 * reminders belong here too once they exist, so this wrapper (not
 * MotRemindersList itself, which stays genuinely MOT-specific) is where that
 * framing lives. */
export function CustomerSaleReminders() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Customer &amp; sale reminders</h1>
      <p className="mt-4 mb-6 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Reminders tied to a customer or a due date, rather than a specific booked appointment.
        Right now the only one supported is MOT expiry, for automotive businesses - other kinds
        (service due, renewals, follow-ups) will appear here as they're added.
      </p>
      <MotRemindersList />
    </div>
  )
}
