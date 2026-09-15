import { useState } from 'react'
import type { AppointmentType, AppointmentTypeGroup } from '../../../types'
import { bookingUrl, bookingUrlForGroup, bookingUrlForService } from '../../../lib/bookingUrl'
import { useGarageId } from '../../../hooks/useGarageId'

/**
 * Links a business can put on its own site.
 *
 * The point is that "Book an MOT" on a garage's homepage should not drop the
 * customer on a menu they have already chosen from. A per-service link skips
 * straight to the calendar; a group link narrows the choice without making it
 * (unless the group holds exactly one service, in which case there is nothing
 * left to choose).
 */
export function ShareLinksPanel({
  groups,
  services,
}: {
  groups: AppointmentTypeGroup[]
  services: AppointmentType[]
}) {
  const garageId = useGarageId()

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Put any of these behind a button on your own website. Each one opens your booking page with
        the choice already made.
      </p>

      <LinkRow label="Your booking page" description="Everything you offer." url={bookingUrl(garageId)} />

      {groups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Groups</h2>
          <ul className="mt-2 space-y-2">
            {groups.map((group) => (
              <li key={group.id}>
                <LinkRow
                  label={group.name}
                  description={
                    services.filter((s) => s.group_id === group.id).length === 1
                      ? 'Only one service in this group, so it skips straight to the calendar.'
                      : 'Opens on the group, with the choice still to make.'
                  }
                  url={bookingUrlForGroup(garageId, group.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Services</h2>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Add a service on the Appointment Types page and its link will appear here.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {services.map((service) => (
              <li key={service.id}>
                <LinkRow
                  label={service.name}
                  description="Skips straight to picking a date and time."
                  url={bookingUrlForService(garageId, service.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LinkRow({
  label,
  description,
  url,
}: {
  label: string
  description: string
  url: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (an insecure origin, a permission
      // prompt declined). The url is on screen and selectable either way, so
      // there is nothing to recover from - just don't claim it was copied.
      setCopied(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{description}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
