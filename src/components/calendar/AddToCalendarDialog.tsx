import { useId, useMemo, useState } from 'react'
import type {
  CalendarFeedWithUrl,
  CalendarFilter,
  CalendarScope,
} from '../../api/calendarExport'
import {
  useAppointmentTypes,
  useCreateCalendarFeed,
  useDownloadAppointmentsIcs,
  useEmployees,
} from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import {
  DAYS_BACK_OPTIONS,
  DAYS_FORWARD_OPTIONS,
  DOWNLOAD_PRESETS,
  type DateRange,
  type DownloadPreset,
  daysBackLabel,
  downloadRangeError,
  presetRange,
} from '../../lib/calendarExport'
import { todayIso } from '../../lib/datetime'
import { saveBlob } from '../../lib/download'
import { employeeDisplayName, isOwner } from '../../lib/employees'
import { errorMessage } from '../../lib/errors'
import { Modal } from '../Modal'
import { useToast } from '../Toast'
import { CalendarFeedList } from './CalendarFeedList'
import { SubscriptionLinkPanel } from './SubscriptionLinkPanel'

type Tab = 'download' | 'subscribe'

interface AddToCalendarDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-fills the download range from what the calendar is showing. */
  initialRange?: DateRange
  /** Pre-fills "whose calendar" from the calendar's worker filter ('' = all). */
  initialEmployeeId?: string
}

const inputClass =
  'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none'
const tabClass = (active: boolean) =>
  `px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
    active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
  }`

/**
 * "Add to calendar": a one-off .ics download or a live subscription link, built
 * from one shared filter (whose calendar, which appointment types) so both
 * always mean the same thing. Owners may pick any workers; everyone else only
 * ever sees "Just me" - and the API enforces the same rule regardless.
 */
export function AddToCalendarDialog({
  open,
  onClose,
  initialRange,
  initialEmployeeId = '',
}: AddToCalendarDialogProps) {
  const idPrefix = useId()
  const { employeeId } = useAuth()
  const { showToast } = useToast()
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes()
  const download = useDownloadAppointmentsIcs()
  const createFeed = useCreateCalendarFeed()

  const me = employees?.find((e) => e.id === employeeId)
  // Until the employee list says otherwise, show the STAFF options - never
  // flash owner-only choices at someone who can't use them.
  const owner = isOwner(me)
  const activeEmployees = useMemo(() => (employees ?? []).filter((e) => e.is_active), [employees])

  // The page's worker filter decides the starting point for an owner: that
  // worker, or everyone when the calendar is unfiltered.
  const prefillOther = Boolean(initialEmployeeId) && initialEmployeeId !== employeeId
  const defaultScope: CalendarScope = !owner
    ? 'ME'
    : prefillOther
      ? 'SELECTED'
      : initialEmployeeId
        ? 'ME'
        : 'ALL'

  const [tab, setTab] = useState<Tab>('download')
  // null = untouched, so the defaults above apply once the role is known.
  const [scopeChoice, setScope] = useState<CalendarScope | null>(null)
  const [employeeChoice, setSelectedEmployees] = useState<string[] | null>(null)
  const [typeChoice, setSelectedTypes] = useState<string[] | null>(null)

  // Non-owners only ever export their own calendar, whatever was chosen.
  const scope: CalendarScope = owner ? (scopeChoice ?? defaultScope) : 'ME'
  const selectedEmployees = employeeChoice ?? (prefillOther ? [initialEmployeeId] : [])
  const allTypeIds = useMemo(() => (appointmentTypes ?? []).map((t) => t.id), [appointmentTypes])
  const selectedTypes = typeChoice ?? allTypeIds

  const [preset, setPreset] = useState<DownloadPreset>(initialRange ? 'custom' : 'week')
  const [customRange, setCustomRange] = useState<DateRange>(
    initialRange ?? presetRange('week', todayIso()),
  )
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [feedName, setFeedName] = useState('')
  const [daysBack, setDaysBack] = useState(7)
  const [daysForward, setDaysForward] = useState(90)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [shownLink, setShownLink] = useState<CalendarFeedWithUrl | null>(null)
  const [confirming, setConfirming] = useState(false)

  const range = preset === 'custom' ? customRange : presetRange(preset, todayIso())
  const rangeError = downloadRangeError(range)

  const filterError = (() => {
    if (scope === 'SELECTED' && selectedEmployees.length === 0) return 'Choose at least one worker.'
    if (appointmentTypes && selectedTypes.length === 0) {
      return 'Choose at least one appointment type.'
    }
    return null
  })()

  const filter = (): CalendarFilter => {
    const allTypes = allTypeIds.every((id) => selectedTypes.includes(id))
    return {
      scope,
      employee_ids: scope === 'SELECTED' ? selectedEmployees : [],
      // Every type selected = "all types", which also covers ones added later.
      appointment_type_ids: allTypes ? null : selectedTypes,
    }
  }

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const handleDownload = async () => {
    setDownloadError(null)
    try {
      const blob = await download.mutateAsync({
        ...filter(),
        start_date: range.start,
        end_date: range.end,
      })
      saveBlob(blob, 'appointments.ics')
      showToast('Calendar file downloaded. Open it to add the appointments.', 'success')
    } catch (err) {
      setDownloadError(errorMessage(err))
    }
  }

  const defaultFeedName = scope === 'ME' ? 'My appointments' : 'Team appointments'

  const handleCreateFeed = async () => {
    setFeedError(null)
    try {
      const created = await createFeed.mutateAsync({
        ...filter(),
        name: feedName.trim() || defaultFeedName,
        days_back: daysBack,
        days_forward: daysForward,
      })
      setShownLink(created)
      setFeedName('')
    } catch (err) {
      setFeedError(errorMessage(err))
    }
  }

  const close = () => {
    // Escape while a confirmation is open belongs to the confirmation.
    if (confirming) return
    setShownLink(null)
    onClose()
  }

  const scopeOptions: { value: CalendarScope; label: string }[] = owner
    ? [
        { value: 'ME', label: 'Just me' },
        { value: 'ALL', label: 'All workers' },
        { value: 'SELECTED', label: 'Selected workers' },
      ]
    : [{ value: 'ME', label: 'Just me' }]

  return (
    <Modal open={open} title="Add to calendar" onClose={close} size="xl">
      <p className="text-sm text-slate-600">
        Get appointments into Apple Calendar or Google Calendar. Calendar events show the service
        and vehicle registration only, never customer details.
      </p>

      {/* Shared filter: the download and the subscription mean the same thing. */}
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-900">Whose calendar</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {scopeOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={`${idPrefix}-scope`}
                value={option.value}
                checked={scope === option.value}
                onChange={() => setScope(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {owner && scope === 'SELECTED' && (
          <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 p-2">
            {activeEmployees.map((e) => (
              <label key={e.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(e.id)}
                  onChange={() => setSelectedEmployees(toggle(selectedEmployees, e.id))}
                />
                {employeeDisplayName(e)}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-900">Appointment types</legend>
        <div className="mt-1 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSelectedTypes(allTypeIds)}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelectedTypes([])}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Clear
          </button>
        </div>
        <div className="mt-1 grid max-h-36 grid-cols-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
          {(appointmentTypes ?? []).map((t) => (
            <label key={t.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selectedTypes.includes(t.id)}
                onChange={() => setSelectedTypes(toggle(selectedTypes, t.id))}
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>

      {filterError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {filterError}
        </p>
      )}

      <div role="tablist" aria-label="How to add" className="mt-5 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          role="tab"
          id={`${idPrefix}-tab-download`}
          aria-selected={tab === 'download'}
          aria-controls={`${idPrefix}-panel-download`}
          onClick={() => setTab('download')}
          className={tabClass(tab === 'download')}
        >
          Download file
        </button>
        <button
          type="button"
          role="tab"
          id={`${idPrefix}-tab-subscribe`}
          aria-selected={tab === 'subscribe'}
          aria-controls={`${idPrefix}-panel-subscribe`}
          onClick={() => setTab('subscribe')}
          className={tabClass(tab === 'subscribe')}
        >
          Subscribe (stays updated)
        </button>
      </div>

      {tab === 'download' && (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-download`}
          aria-labelledby={`${idPrefix}-tab-download`}
          className="pt-4"
        >
          <p className="text-sm text-slate-600">
            A one-off snapshot to import. Later changes won’t appear - subscribe instead to keep
            your calendar up to date.
          </p>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-slate-900">Time range</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {DOWNLOAD_PRESETS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`${idPrefix}-preset`}
                    value={option.value}
                    checked={preset === option.value}
                    onChange={() => setPreset(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-600" htmlFor={`${idPrefix}-from`}>
                  From
                </label>
                <input
                  id={`${idPrefix}-from`}
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                  className={inputClass}
                />
                <label className="text-sm text-slate-600" htmlFor={`${idPrefix}-to`}>
                  to
                </label>
                <input
                  id={`${idPrefix}-to`}
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
            {rangeError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {rangeError}
              </p>
            )}
          </fieldset>

          {downloadError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {downloadError}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDownload}
              disabled={download.isPending || !!rangeError || !!filterError}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {download.isPending ? 'Preparing…' : 'Download .ics file'}
            </button>
          </div>
        </div>
      )}

      {tab === 'subscribe' && (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-subscribe`}
          aria-labelledby={`${idPrefix}-tab-subscribe`}
          className="pt-4"
        >
          {shownLink ? (
            <SubscriptionLinkPanel feed={shownLink} onDone={() => setShownLink(null)} />
          ) : (
            <>
              <p className="text-sm text-slate-600">
                A private, read-only link your calendar app checks for changes, so new, moved and
                cancelled appointments update automatically.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
                  Link name
                  <input
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    placeholder={defaultFeedName}
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Include the last
                  <select
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value))}
                    className={inputClass}
                  >
                    {DAYS_BACK_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {daysBackLabel(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  and the next
                  <select
                    value={daysForward}
                    onChange={(e) => setDaysForward(Number(e.target.value))}
                    className={inputClass}
                  >
                    {DAYS_FORWARD_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} days
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {feedError && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {feedError}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateFeed}
                  disabled={createFeed.isPending || !!filterError}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {createFeed.isPending ? 'Creating…' : 'Create subscription link'}
                </button>
              </div>
            </>
          )}

          <CalendarFeedList
            currentEmployeeId={employeeId}
            employees={employees}
            appointmentTypes={appointmentTypes}
            onRegenerated={setShownLink}
            onConfirmingChange={setConfirming}
          />
        </div>
      )}
    </Modal>
  )
}
