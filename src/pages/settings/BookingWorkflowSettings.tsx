import { useState } from 'react'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'
import {
  useAppointmentTypeGroups,
  useAppointmentTypes,
  useApplyBookingFlowPreset,
  useBookingFlowPresets,
  useBookingFlowSections,
  useGarage,
  useUpdateBookingRequestSettings,
} from '../../api/queries'
import { GroupsPanel } from './bookingWorkflow/GroupsPanel'
import { WorkflowPanel } from './bookingWorkflow/WorkflowPanel'
import { ShareLinksPanel } from './bookingWorkflow/ShareLinksPanel'

/**
 * Settings › Booking Workflow.
 *
 * Three things a business controls about how customers book, kept on one
 * page because they are the same decision seen from three angles: what is on
 * offer and how it looks, what the customer is asked, and where the link
 * points.
 */
const TABS = [
  { key: 'groups', label: 'Services & groups' },
  { key: 'workflow', label: 'What you ask' },
  { key: 'links', label: 'Share links' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function BookingWorkflowSettings() {
  const [tab, setTab] = useState<TabKey>('groups')

  const groups = useAppointmentTypeGroups()
  const services = useAppointmentTypes()
  const sections = useBookingFlowSections()
  const garage = useGarage()
  const autoAccept = useUpdateBookingRequestSettings()

  const forbidden = [groups.error, services.error, sections.error].some(
    (e) => isApiError(e) && e.code === 403,
  )

  return (
    <SettingsLayout>
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900">Booking Workflow</h1>
        <p className="mt-1 text-sm text-slate-500">
          What customers can book, how it's presented, and what you ask them.
        </p>

        {forbidden && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only an owner can change the booking workflow.
          </p>
        )}

        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Booking request approval</h2>
            <p className="mt-1 text-sm text-slate-600">
              When enabled, a request is accepted only if its requested slot still has capacity and an active employee can be assigned without a clash. Otherwise it stays pending for staff review.
            </p>
            <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={garage.data?.auto_accept_booking_requests ?? false}
                disabled={garage.isLoading || autoAccept.isPending}
                onChange={(event) => autoAccept.mutate(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span><strong>Auto-accept available booking requests</strong><br />Existing bookings and deposit/payment holds are not changed.</span>
            </label>
            {autoAccept.isError && <p className="mt-2 text-sm text-red-600">{errorMessage(autoAccept.error)}</p>}
          </section>
          {tab === 'groups' && (
            <GroupsPanel
              groups={groups.data ?? []}
              services={services.data ?? []}
              loading={groups.isLoading || services.isLoading}
            />
          )}
          {tab === 'workflow' && (
            <WorkflowPanel
              sections={sections.data ?? []}
              services={services.data ?? []}
              loading={sections.isLoading}
            />
          )}
          {tab === 'links' && (
            <ShareLinksPanel groups={groups.data ?? []} services={services.data ?? []} />
          )}
        </div>
      </div>
    </SettingsLayout>
  )
}

/**
 * Offered only when a business has no workflow at all - an empty booking form
 * on day one is a bad first impression, and a preset is just seed data it can
 * edit or delete afterwards. Never offered once anything exists: merging
 * would duplicate sections and replacing would discard real configuration.
 */
export function PresetPicker() {
  const { data } = useBookingFlowPresets()
  const applyPreset = useApplyBookingFlowPreset()
  const { showToast } = useToast()
  const [preset, setPreset] = useState('')

  const presets = data?.presets ?? []
  if (presets.length === 0) return null

  const apply = async () => {
    if (!preset) return
    try {
      await applyPreset.mutateAsync(preset)
      showToast('Starting questions added. Edit or remove anything you like.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 p-4">
      <p className="text-sm font-medium text-slate-900">Start from a template</p>
      <p className="mt-1 text-sm text-slate-500">
        You don't ask customers anything beyond their name and contact details yet. Pick a starting
        point if one fits — everything it adds is yours to edit or delete.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="workflow-preset">
          Template
        </label>
        <select
          id="workflow-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Choose a template…</option>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {PRESET_LABELS[p.key] ?? p.key} — {p.sections.join(', ')}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={!preset || applyPreset.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {applyPreset.isPending ? 'Adding…' : 'Use this template'}
        </button>
      </div>
    </div>
  )
}

/** Human names for the preset keys the backend exposes. An unknown key falls
 * back to the key itself, so adding one server-side never renders nothing. */
const PRESET_LABELS: Record<string, string> = {
  automotive: 'Vehicles',
  appointments: 'Appointments',
  generic: 'Minimal',
}
