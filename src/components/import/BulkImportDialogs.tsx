import {
  useAppointmentStatuses,
  useAppointmentTypes,
  useBulkImportAppointmentTypes,
  useBulkImportAppointments,
  useGarage,
  useImportFormats,
} from '../../api/queries'
import { Modal } from '../Modal'
import { useToast } from '../Toast'
import { errorMessage } from '../../lib/errors'
import type { ImportResult } from '../../types'
import { AppointmentsPreview } from './AppointmentsPreview'
import { ErrorNote } from './controls'
import { ImportPanel } from './ImportPanel'
import { ServicesPreview } from './ServicesPreview'

/**
 * The two owner-facing imports, each in a modal: services from a price list,
 * and existing bookings from a diary. Both follow paste → preview → import,
 * with every rule decided by the server.
 */

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function BulkAddServicesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const formats = useImportFormats(open)
  const { data: types } = useAppointmentTypes()
  const importTypes = useBulkImportAppointmentTypes()

  const commit = async (payload: unknown, _result: ImportResult, acknowledged: boolean) => {
    const done = await importTypes.mutateAsync({
      payload,
      dryRun: false,
      acknowledgeWarnings: acknowledged,
    })
    showToast(
      `Added ${plural(done.counts.new, 'service')}${
        done.counts.exists ? `; ${done.counts.exists} already existed and were left unchanged` : ''
      }.`,
      'success',
    )
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk add services (JSON)" size="2xl">
      {formats.error ? <ErrorNote>{errorMessage(formats.error)}</ErrorNote> : null}
      <ImportPanel
        kind="services"
        format={formats.data?.services}
        promptValues={{ service_names: (types ?? []).map((t) => t.name) }}
        preview={(payload) => importTypes.mutateAsync({ payload, dryRun: true })}
        commit={{ label: (result) => `Add ${plural(result.counts.new, 'service')}`, run: commit }}
        renderItems={(result) => <ServicesPreview result={result} />}
      />
    </Modal>
  )
}

export function ImportAppointmentsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const formats = useImportFormats(open)
  const { data: types } = useAppointmentTypes('ACTIVE')
  const { data: statuses } = useAppointmentStatuses()
  const { data: garage } = useGarage()
  const importAppointments = useBulkImportAppointments()

  const commit = async (payload: unknown, _result: ImportResult, acknowledged: boolean) => {
    const done = await importAppointments.mutateAsync({
      payload,
      dryRun: false,
      acknowledgeWarnings: acknowledged,
    })
    showToast(
      `Imported ${plural(done.counts.new, 'appointment')}${
        done.counts.exists ? `; skipped ${done.counts.exists} already in the diary` : ''
      }.`,
      'success',
    )
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Import appointments" size="2xl">
      <p className="mb-3 text-sm text-slate-600">
        Bring in bookings from your existing diary. Imported appointments send customers nothing
        and get no automated reminders until you reschedule them.
      </p>
      {formats.error ? <ErrorNote>{errorMessage(formats.error)}</ErrorNote> : null}
      <ImportPanel
        kind="appointments"
        format={formats.data?.appointments}
        promptValues={{
          service_names: (types ?? []).map((t) => t.name),
          timezone: garage?.timezone ?? formats.data?.defaults.timezone,
          statuses: statuses?.length
            ? statuses.map((s) => s.key)
            : formats.data?.defaults.statuses,
        }}
        preview={(payload) => importAppointments.mutateAsync({ payload, dryRun: true })}
        commit={{
          label: (result) => `Import ${plural(result.counts.new, 'appointment')}`,
          run: commit,
        }}
        renderItems={(result) => <AppointmentsPreview result={result} />}
      />
    </Modal>
  )
}
