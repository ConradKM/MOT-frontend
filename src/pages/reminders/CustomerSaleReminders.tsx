/** Customer / Sale Reminders is the generic "follow up with a customer by
 * some due date/event" concept - service-due, renewals, post-sale follow-up,
 * recurring maintenance and re-engagement reminders belong here once they
 * exist. None are implemented yet. */
export function CustomerSaleReminders() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Customer &amp; sale reminders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Reminders tied to a customer or a due date, rather than a specific booked appointment.
      </p>
      <p className="mt-6 rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
        No customer or sale reminders are available yet.
      </p>
    </div>
  )
}
