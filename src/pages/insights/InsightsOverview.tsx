import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadInsightsCsv, isLocked, type Insights } from '../../api/insights'
import { useEmployees, useInsights } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { useIsOwner } from '../../hooks/useIsOwner'
import { ApiError } from '../../api/client'
import { saveBlob } from '../../lib/download'
import {
  CustomersPanel,
  HeadlineCards,
  HeatmapPanel,
  LockedPanel,
  SourcesPanel,
  StaffPanel,
  TopServicesPanel,
  TrendPanel,
} from './InsightsPanels'
import { RANGE_PRESETS, rangeError, rangeFor, type DateRange, type RangePreset } from './insightsFormat'

const FIELD =
  'min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'

const LOCKED_COPY = {
  trend: 'See appointments, new customers and booked value over time.',
  heatmap: 'See which days and hours are busiest, so you can plan staffing.',
  staff: 'Compare appointments, completion and no-shows across your team.',
  customers: 'See new versus returning customers, and who is due back for each service.',
}

function employeeName(e: { first_name: string | null; last_name: string | null; email: string }) {
  return [e.first_name, e.last_name].filter(Boolean).join(' ') || e.email
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
    </div>
  )
}

function Panels({ insights, garageId }: { insights: Insights; garageId: string }) {
  const money = insights.scope.money_visible
  const { trend, heatmap, staff, customers } = insights
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {isLocked(trend) ? (
        <LockedPanel title="Trend" description={LOCKED_COPY.trend} className="lg:col-span-2" />
      ) : (
        <TrendPanel data={trend} money={money} />
      )}
      <TopServicesPanel data={insights.top_services} money={money} />
      <SourcesPanel sources={insights.sources} />
      {isLocked(heatmap) ? (
        <LockedPanel title="Busy days and times" description={LOCKED_COPY.heatmap} className="lg:col-span-2" />
      ) : (
        <HeatmapPanel data={heatmap} />
      )}
      {/* Staff is owners-only: null for a staff member's own view. */}
      {staff !== null &&
        (isLocked(staff) ? (
          <LockedPanel title="Staff" description={LOCKED_COPY.staff} className="lg:col-span-2" />
        ) : (
          <StaffPanel rows={staff.rows} />
        ))}
      {isLocked(customers) ? (
        <LockedPanel title="Customers" description={LOCKED_COPY.customers} className="lg:col-span-2" />
      ) : (
        <CustomersPanel data={customers} garageId={garageId} employeeId={insights.scope.employee_id} />
      )}
    </div>
  )
}

/** The Overview tab under Insights: a business's own analytics, backed by
 * GET /api/insights. Owners see money and the whole team; everyone else sees
 * their own appointments as counts only - decided by the API, which leaves
 * the money out of their payload entirely. */
export function InsightsOverview() {
  const garageId = useGarageId()
  const isOwner = useIsOwner()
  const { data: employees } = useEmployees()
  const [preset, setPreset] = useState<RangePreset>('last30')
  const [custom, setCustom] = useState<DateRange>(() => rangeFor('last30'))
  const [employeeId, setEmployeeId] = useState<string>('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const range = preset === 'custom' ? custom : rangeFor(preset)
  const invalid = preset === 'custom' ? rangeError(custom) : null
  const params = { ...range, employeeId: isOwner ? employeeId || null : null }
  const { data, error, isPending, isFetching, refetch } = useInsights(params, !invalid)
  const insights = invalid ? undefined : data

  const exportCsv = async () => {
    setExportError(null)
    setExporting(true)
    try {
      const blob = await downloadInsightsCsv(params)
      saveBlob(blob, `insights-${range.start}-to-${range.end}.csv`)
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'The export could not be downloaded.')
    } finally {
      setExporting(false)
    }
  }

  const canExport = !!insights && !isLocked(insights.export)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Insights</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isOwner ? 'How the business is doing.' : 'How your appointments are going.'}
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>
      {exportError && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {exportError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="insights-range" className="text-xs font-medium text-slate-600">
            Period
          </label>
          <select
            id="insights-range"
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className={FIELD}
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="insights-start" className="text-xs font-medium text-slate-600">
                From
              </label>
              <input
                id="insights-start"
                type="date"
                value={custom.start}
                onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="insights-end" className="text-xs font-medium text-slate-600">
                To
              </label>
              <input
                id="insights-end"
                type="date"
                value={custom.end}
                onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                className={FIELD}
              />
            </div>
          </>
        )}
        {isOwner && (employees?.length ?? 0) > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="insights-staff" className="text-xs font-medium text-slate-600">
              Staff
            </label>
            <select
              id="insights-staff"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={FIELD}
            >
              <option value="">Everyone</option>
              {employees!.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {invalid && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {invalid}
        </p>
      )}

      <div className="mt-6" aria-busy={isFetching}>
        {invalid ? null : isPending ? (
          <Skeleton />
        ) : error && !insights ? (
          <div role="alert" className="rounded-lg bg-white p-5 shadow-card">
            <p className="text-sm text-slate-700">
              {error instanceof ApiError ? error.message : 'Insights could not be loaded.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : insights ? (
          <>
            {insights.summary.appointments.total === 0 && (
              <p className="mb-4 rounded-lg bg-white p-4 text-sm text-slate-600 shadow-card">
                No appointments in this period yet.
              </p>
            )}
            <HeadlineCards insights={insights} />
            <Panels insights={insights} garageId={garageId} />
          </>
        ) : null}
      </div>
    </div>
  )
}
