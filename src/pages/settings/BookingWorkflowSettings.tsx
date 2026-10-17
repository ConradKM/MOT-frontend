import { useState } from 'react'
import { SettingsTabs, useTabParam } from '../../components/settings/SettingsTabs'
import {
  SectionHeading,
  SettingsCard,
  SettingsPageHeader,
} from '../../components/settings/SettingsUI'
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

/**
 * Settings › Booking Workflow.
 *
 * Two things a business controls about how customers book, kept on one page
 * because they are the same decision seen from two angles: what is on offer
 * and how it looks, and what the customer is asked. (Where the links point
 * lives on the Share your business page.)
 */
const TABS = [
  { key: 'groups', label: 'Services & groups' },
  { key: 'workflow', label: 'What you ask' },
] as const

type TabKey = (typeof TABS)[number]['key']
const TAB_KEYS = TABS.map((t) => t.key)

export function BookingWorkflowSettings() {
  const [tab, setTab] = useTabParam<TabKey>(TAB_KEYS)

  const groups = useAppointmentTypeGroups()
  const services = useAppointmentTypes()
  const sections = useBookingFlowSections()
  const garage = useGarage()
  const autoAccept = useUpdateBookingRequestSettings()

  const forbidden = [groups.error, services.error, sections.error].some(
    (e) => isApiError(e) && e.code === 403,
  )

  return (
    <div className="max-w-3xl">
      <SettingsPageHeader
        title="Booking Workflow"
        description="What customers can book, how it's presented, and what you ask them."
      />

      {forbidden && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only an owner can change the booking workflow.
        </p>
      )}

      <SettingsCard as="section" aria-labelledby="booking-approval-heading" className="mt-6">
        <SectionHeading
          as="h3"
          id="booking-approval-heading"
          title="Booking request approval"
          info="When enabled, a request is accepted only if its requested slot still has capacity and an active employee can be assigned without a clash. Otherwise it stays pending for staff review. Existing bookings and deposit/payment holds are not changed."
        />
        <div className="mt-3 flex items-center gap-3">
          <input
            id="auto-accept-booking-requests"
            type="checkbox"
            checked={garage.data?.auto_accept_booking_requests ?? false}
            disabled={garage.isLoading || autoAccept.isPending}
            onChange={(event) => autoAccept.mutate(event.target.checked)}
            className="h-4 w-4"
          />
          <label
            htmlFor="auto-accept-booking-requests"
            className="text-sm font-medium text-slate-900"
          >
            Auto-accept available booking requests
          </label>
        </div>
        {autoAccept.isError && (
          <p className="mt-2 text-sm text-red-600">{errorMessage(autoAccept.error)}</p>
        )}
      </SettingsCard>

      <div className="mt-8">
        <SettingsTabs tabs={TABS} active={tab} onChange={setTab} label="Booking workflow">
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
        </SettingsTabs>
      </div>
    </div>
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
    <SettingsCard>
      <SectionHeading
        as="h3"
        title="Start from a template"
        info="You don't ask customers anything beyond their name and contact details yet. Pick a starting point if one fits — everything it adds is yours to edit or delete."
      />
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
    </SettingsCard>
  )
}

/** Human names for the preset keys the backend exposes. An unknown key falls
 * back to the key itself, so adding one server-side never renders nothing. */
const PRESET_LABELS: Record<string, string> = {
  automotive: 'Vehicles',
  appointments: 'Appointments',
  generic: 'Minimal',
}
