import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useGarageId } from '../../hooks/useGarageId'
import {
  useAutomationSettings,
  useGarage,
  useMessageTemplates,
  usePreviewMessageTemplate,
  useResetMessageTemplate,
  useUpdateAutomationSettings,
  useUpdateMessageTemplate,
} from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import type { AutomationSettings, MessageTemplate } from '../../api/communications'
import { PhoneMenuPanel } from './PhoneMenuPanel'
import { InfoTip } from '../../components/settings/InfoTip'
import { SettingsTabs, useTabParam } from '../../components/settings/SettingsTabs'
import {
  SectionHeading,
  SettingsCard,
  SettingsPageHeader,
} from '../../components/settings/SettingsUI'

const TEMPLATE_LABELS: Record<string, string> = {
  booking_acknowledgement: 'Booking request received',
  booking_confirmation: 'Booking confirmed',
  booking_rejected: 'Booking declined',
  appointment_reminder: 'Appointment reminder',
  appointment_cancelled: 'Appointment cancelled',
  appointment_rescheduled: 'Appointment rescheduled',
  missed_call_ack: 'Missed call follow-up',
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-slate-300"
      />
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      <InfoTip label={label}>{description}</InfoTip>
    </div>
  )
}

function AutomationTogglesForm({ settings }: { settings: AutomationSettings }) {
  const update = useUpdateAutomationSettings()
  const { showToast } = useToast()
  const garageId = useGarageId()
  const [form, setForm] = useState(settings)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setForm(settings), [settings])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync(form)
      showToast('Automation settings saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can change automation settings.')
        return
      }
      const fields = fieldErrors(err)
      setError(Object.values(fields)[0] ?? errorMessage(err))
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="divide-y divide-slate-100 rounded-lg bg-white shadow-card">
        <ToggleRow
          id="conversation-automation"
          label="Automated WhatsApp assistant"
          description="Let the assistant answer bookings, availability, prices and simple questions automatically. Off by default - customers only get automated replies once you turn this on."
          checked={form.conversation_automation_enabled}
          onChange={(v) => setForm((f) => ({ ...f, conversation_automation_enabled: v }))}
        />
        <ToggleRow
          id="booking-ack"
          label="Booking request received"
          description="Sends an acknowledgement the moment a customer submits a booking request."
          checked={form.booking_ack_enabled}
          onChange={(v) => setForm((f) => ({ ...f, booking_ack_enabled: v }))}
        />
        <ToggleRow
          id="booking-confirmation"
          label="Booking confirmed / declined / cancelled / rescheduled"
          description="Sends a message whenever a booking request is approved or rejected, or an appointment is cancelled or rescheduled."
          checked={form.booking_confirmation_enabled}
          onChange={(v) => setForm((f) => ({ ...f, booking_confirmation_enabled: v }))}
        />
        <ToggleRow
          id="missed-call-ack"
          label="Missed call follow-up"
          description="Sends a WhatsApp message when a call to your business goes unanswered."
          checked={form.missed_call_ack_enabled}
          onChange={(v) => setForm((f) => ({ ...f, missed_call_ack_enabled: v }))}
        />
      </div>
      <p className="text-sm text-slate-700">
        Appointment reminders live on their own page:{' '}
        <Link to={`/${garageId}/settings/reminders`} className="font-medium underline">
          Appointment Reminders
        </Link>
      </p>

      <button
        type="submit"
        disabled={update.isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save automation settings'}
      </button>
    </form>
  )
}

function TemplateEditor({ template }: { template: MessageTemplate }) {
  const update = useUpdateMessageTemplate()
  const reset = useResetMessageTemplate()
  const preview = usePreviewMessageTemplate()
  const { showToast } = useToast()

  const [body, setBody] = useState(template.body)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBody(template.body)
    setPreviewText(null)
  }, [template.body])

  const dirty = body !== template.body
  const busy = update.isPending || reset.isPending

  const handleSave = async () => {
    setError(null)
    try {
      await update.mutateAsync({ key: template.key, body })
      showToast('Template saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can edit message templates.')
        return
      }
      setError(errorMessage(err))
    }
  }

  const handleReset = async () => {
    try {
      const result = await reset.mutateAsync(template.key)
      setBody(result.body)
      showToast('Reverted to the default wording.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handlePreview = async () => {
    try {
      const result = await preview.mutateAsync({ key: template.key, body })
      setPreviewText(result.preview)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <SettingsCard>
      <div className="flex items-center justify-between">
        <label htmlFor={`template-${template.key}`} className="text-base font-semibold text-slate-900">
          {TEMPLATE_LABELS[template.key] ?? template.key}
        </label>
        {template.is_custom && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            Customised
          </span>
        )}
      </div>

      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <textarea
        id={`template-${template.key}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      {previewText && (
        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
          <p className="text-xs font-medium uppercase text-slate-600">Preview</p>
          {previewText}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || busy}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={preview.isPending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Preview
        </button>
        {template.is_custom && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Reset to default
          </button>
        )}
      </div>
    </SettingsCard>
  )
}

const TABS = [
  { key: 'automation', label: 'Automated messages' },
  { key: 'phone-menu', label: 'Phone menu' },
  { key: 'templates', label: 'Message templates' },
] as const

type TabKey = (typeof TABS)[number]['key']
const TAB_KEYS = TABS.map((t) => t.key)

export function CommunicationsAutomationSettings() {
  const { data: settings, isLoading: settingsLoading } = useAutomationSettings()
  const { data: templatesData, isLoading: templatesLoading } = useMessageTemplates()
  const { data: garage } = useGarage()

  // `#phone-menu` was the Phone menu section's anchor before the tabs; it
  // still opens that tab.
  const [tab, setTab] = useTabParam<TabKey>(TAB_KEYS, { 'phone-menu': 'phone-menu' })

  if (settingsLoading || templatesLoading || !settings) {
    return (
      <p className="text-sm text-slate-500">Loading…</p>
    )
  }

  return (
    <div className="max-w-2xl">
      <SettingsPageHeader
        title="Communications automation"
        info={
          <>
            Choose which automated messages your business sends, and customise their wording.
            This never touches your phone/WhatsApp connection details, which stay with the CoMaz
            OS team.
          </>
        }
      />

      <div className="mt-6">
        <SettingsTabs tabs={TABS} active={tab} onChange={setTab} label="Communications automation">
          {tab === 'automation' && <AutomationTogglesForm settings={settings} />}
          {tab === 'phone-menu' && (
            <>
              <SectionHeading
                id="phone-menu"
                title="Phone menu"
                info="What callers hear first, and where each keypad option takes them - for example 1 for the booking assistant, 2 to speak to your team."
              />
              <SettingsCard className="mt-3">
                <PhoneMenuPanel businessName={garage?.name} />
              </SettingsCard>
            </>
          )}
          {tab === 'templates' && (
            <>
              <SectionHeading
                title="Message templates"
                info={
                  <>
                    The exact wording sent for each automated message. Leave any as they are to
                    use CoMaz OS's default wording. You can use {'{{business_name}}'},{' '}
                    {'{{customer_first_name}}'}, {'{{appointment_type}}'},{' '}
                    {'{{appointment_date}}'} and {'{{appointment_time}}'}; anything else is left
                    as plain text.
                  </>
                }
              />
              <div className="mt-3 space-y-4">
                {(templatesData?.items ?? []).map((template) => (
                  <TemplateEditor key={template.key} template={template} />
                ))}
              </div>
            </>
          )}
        </SettingsTabs>
      </div>
    </div>
  )
}
