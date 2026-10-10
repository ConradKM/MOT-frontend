import { useState } from 'react'
import type { CalendarFeed, CalendarFeedWithUrl } from '../../api/calendarExport'
import {
  useCalendarFeeds,
  useRegenerateCalendarFeed,
  useRevokeCalendarFeed,
} from '../../api/queries'
import { feedScopeSummary } from '../../lib/calendarExport'
import { formatDateShort } from '../../lib/datetime'
import { employeeNameById } from '../../lib/employees'
import { errorMessage } from '../../lib/errors'
import type { AppointmentType, Employee } from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { useToast } from '../Toast'

interface CalendarFeedListProps {
  currentEmployeeId: string | null
  employees: Employee[] | undefined
  appointmentTypes: AppointmentType[] | undefined
  /** A regenerated link's new URL - shown once by the parent. */
  onRegenerated: (feed: CalendarFeedWithUrl) => void
  /** Lets the parent dialog ignore Escape while a confirmation is open. */
  onConfirmingChange: (confirming: boolean) => void
}

type Pending = { action: 'regenerate' | 'revoke'; feed: CalendarFeed } | null

/** "Your calendar links": what exists, whether it's in use, and the two ways
 * to end a link. Never shows a URL - the API doesn't return one here. */
export function CalendarFeedList({
  currentEmployeeId,
  employees,
  appointmentTypes,
  onRegenerated,
  onConfirmingChange,
}: CalendarFeedListProps) {
  const { data: feeds, isLoading, isError } = useCalendarFeeds()
  const regenerate = useRegenerateCalendarFeed()
  const revoke = useRevokeCalendarFeed()
  const { showToast } = useToast()
  const [pending, setPendingState] = useState<Pending>(null)

  const setPending = (next: Pending) => {
    setPendingState(next)
    onConfirmingChange(next !== null)
  }

  const confirm = async () => {
    if (!pending) return
    try {
      if (pending.action === 'regenerate') {
        onRegenerated(await regenerate.mutateAsync(pending.feed.id))
        showToast('New link created. The old one has stopped working.', 'success')
      } else {
        await revoke.mutateAsync(pending.feed.id)
        showToast('Link revoked.', 'success')
      }
    } catch (err) {
      showToast(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  return (
    <section aria-labelledby="calendar-links-heading" className="mt-6">
      <h3 id="calendar-links-heading" className="text-sm font-semibold text-slate-900">
        Your calendar links
      </h3>
      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {isError && <p className="mt-2 text-sm text-red-600">Couldn’t load your calendar links.</p>}
      {feeds && feeds.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">You haven’t created any links yet.</p>
      )}
      {feeds && feeds.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
          {feeds.map((feed) => {
            const mine = feed.created_by_employee_id === currentEmployeeId
            return (
              <li key={feed.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{feed.name}</p>
                  <p className="text-xs text-slate-500">
                    {feedScopeSummary(feed, employees, appointmentTypes)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {!mine && <>By {employeeNameById(employees, feed.created_by_employee_id)} · </>}
                    Created {formatDateShort(feed.created_at)} ·{' '}
                    {feed.last_accessed_at
                      ? `Last used ${formatDateShort(feed.last_accessed_at)}`
                      : 'Never used'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {mine && (
                    <button
                      type="button"
                      onClick={() => setPending({ action: 'regenerate', feed })}
                      aria-label={`Regenerate link ${feed.name}`}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Regenerate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPending({ action: 'revoke', feed })}
                    aria-label={`Revoke link ${feed.name}`}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pending?.action === 'regenerate'}
        title="Regenerate this link?"
        confirmLabel="Regenerate"
        danger
        busy={regenerate.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        The current link for “{pending?.feed.name}” stops working immediately. Anyone subscribed
        with it will need the new link.
      </ConfirmDialog>
      <ConfirmDialog
        open={pending?.action === 'revoke'}
        title="Revoke this link?"
        confirmLabel="Revoke"
        danger
        busy={revoke.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        “{pending?.feed.name}” stops working immediately and its appointments disappear from
        every calendar subscribed to it. This can’t be undone.
      </ConfirmDialog>
    </section>
  )
}
