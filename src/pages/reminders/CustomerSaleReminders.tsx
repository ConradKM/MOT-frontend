import { SettingsPageHeader } from '../../components/settings/SettingsUI'

/** Customer / Sale Reminders is the generic "follow up with a customer by
 * some due date/event" concept - service-due, renewals, post-sale follow-up,
 * recurring maintenance and re-engagement reminders belong here once they
 * exist. None are implemented yet. */
export function CustomerSaleReminders() {
  return (
    <div>
      <SettingsPageHeader
        title="Customer & sale reminders"
        description="Reminders tied to a customer or a due date, rather than a specific booked appointment."
      />
      <p className="mt-6 rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-600 shadow-card">
        No customer or sale reminders are available yet.
      </p>
    </div>
  )
}
