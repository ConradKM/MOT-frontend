import { lazy, Suspense, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react'
import { InfoTip } from '../../components/settings/InfoTip'
import { useDueBack } from '../../api/queries'
import type {
  CustomersSection,
  DueBackPage,
  Heatmap,
  Insights,
  StaffRow,
  TopServices,
  Trend as TrendData,
} from '../../api/insights'
import {
  DEFINITIONS,
  SOURCE_LABELS,
  WEEKDAYS,
  bucketLabel,
  delta,
  formatGbp,
  formatRate,
  hourLabel,
  type Delta,
} from './insightsFormat'

// Recharts is only ever fetched here, and only once a chart is on screen.
const TrendChart = lazy(() => import('./charts/TrendChart'))

export const PRICING_URL = 'https://comaz.co.uk/pricing'

// --------------------------------------------------------------------------
// Building blocks
// --------------------------------------------------------------------------

export function Panel({
  title,
  info,
  summary,
  children,
  className = '',
}: {
  title: string
  info?: string
  summary?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = useId()
  return (
    // min-w-0: a grid item otherwise grows to its widest table, pushing the
    // whole page sideways on a phone instead of scrolling the table.
    <section aria-labelledby={headingId} className={`min-w-0 rounded-lg bg-white p-5 shadow-card ${className}`}>
      <div className="flex items-center gap-1.5">
        <h2 id={headingId} className="font-display text-base font-semibold text-slate-900">
          {title}
        </h2>
        {info && <InfoTip label={title}>{info}</InfoTip>}
      </div>
      {summary && <p className="mt-1 text-sm text-slate-500">{summary}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** An advanced panel on a plan without it: a muted placeholder, not a gap. */
export function LockedPanel({
  title,
  description,
  className = '',
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <Panel title={title} className={`bg-slate-50 ${className}`}>
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-slate-300 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Not on your plan
        </p>
        <p className="text-sm text-slate-500">{description}</p>
        <a
          href={PRICING_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline"
        >
          Upgrade<span className="sr-only"> (opens the pricing page in a new tab)</span>
        </a>
      </div>
    </Panel>
  )
}

/** Tables that may be wider than a phone scroll inside their own wrapper. */
function ScrollTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    // relative: contains the absolutely positioned sr-only text in its cells,
    // which would otherwise escape the scroll box and widen the whole page.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

const TH = 'border-b border-slate-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500'
const TD = 'border-b border-slate-100 px-2 py-2 text-slate-700'

// --------------------------------------------------------------------------
// Headline cards
// --------------------------------------------------------------------------

function DeltaLine({ value }: { value: Delta }) {
  const Icon = value.trend === 'up' ? ArrowUpRight : value.trend === 'down' ? ArrowDownRight : Minus
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {value.text}
    </p>
  )
}

function Card({
  label,
  value,
  info,
  change,
  note,
}: {
  label: string
  value: string
  info: string
  change: Delta
  note?: string
}) {
  return (
    <div role="group" aria-label={label} className="rounded-lg bg-white p-4 shadow-card">
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <InfoTip label={label}>{info}</InfoTip>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {value === 'n/a' ? (
          <span title={DEFINITIONS.rateNa}>
            n/a<span className="sr-only"> ({DEFINITIONS.rateNa})</span>
          </span>
        ) : (
          value
        )}
      </p>
      <DeltaLine value={change} />
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

export function HeadlineCards({ insights }: { insights: Insights }) {
  const { summary: now, previous_summary: before, scope } = insights
  const days = insights.period.days
  const money = scope.money_visible

  const cards = [
    ...(money
      ? [
          <Card
            key="booked"
            label="Booked value"
            value={formatGbp(now.booked_value)}
            info={DEFINITIONS.bookedValue}
            change={delta(Number(now.booked_value), Number(before.booked_value), { days })}
            note={[
              now.lost_count > 0
                ? `${formatGbp(now.lost_value)} lost to ${now.lost_count} no-show${now.lost_count === 1 ? '' : 's'} and cancellation${now.lost_count === 1 ? '' : 's'}`
                : null,
              now.unpriced_appointments
                ? `${now.unpriced_appointments} appointment${now.unpriced_appointments === 1 ? '' : 's'} had no price`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />,
          <Card
            key="deposits"
            label="Deposits collected"
            value={formatGbp(now.deposits_collected)}
            info={DEFINITIONS.deposits}
            change={delta(Number(now.deposits_collected), Number(before.deposits_collected), { days })}
          />,
        ]
      : []),
    <Card
      key="appointments"
      label="Appointments"
      value={String(now.appointments.total)}
      info={DEFINITIONS.appointments}
      change={delta(now.appointments.total, before.appointments.total, { days })}
    />,
    <Card
      key="new"
      label="New customers"
      value={String(now.new_customers)}
      info={DEFINITIONS.newCustomers}
      change={delta(now.new_customers, before.new_customers, { days })}
    />,
    <Card
      key="returning"
      label="Returning rate"
      value={formatRate(now.returning_rate)}
      info={DEFINITIONS.returningRate}
      change={delta(now.returning_rate, before.returning_rate, { days, kind: 'rate' })}
    />,
    <Card
      key="noshow"
      label="No-show rate"
      value={formatRate(now.appointments.no_show_rate)}
      info={DEFINITIONS.noShowRate}
      change={delta(now.appointments.no_show_rate, before.appointments.no_show_rate, {
        days,
        kind: 'rate',
      })}
    />,
  ]

  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
}

// --------------------------------------------------------------------------
// Basic panels
// --------------------------------------------------------------------------

export function TopServicesPanel({ data, money }: { data: TopServices; money: boolean }) {
  const top = data.services[0]
  const max = Math.max(1, ...data.services.map((s) => s.appointments))
  return (
    <Panel
      title="Top services"
      summary={top ? `${top.name} was booked most, ${top.appointments} times.` : 'No services booked in this period.'}
    >
      {data.services.length > 0 && (
        <ScrollTable caption="Appointments by service">
          <thead>
            <tr>
              <th className={TH}>Service</th>
              <th className={`${TH} text-right`}>Booked</th>
              <th className={`${TH} text-right`}>Completed</th>
              {money && <th className={`${TH} text-right`}>Booked value</th>}
            </tr>
          </thead>
          <tbody>
            {data.services.map((service) => (
              <tr key={service.appointment_type_id}>
                <td className={TD}>
                  <span className="block">{service.name}</span>
                  <span
                    className="mt-1 block h-1.5 rounded-full bg-slate-700"
                    style={{ width: `${(service.appointments / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </td>
                <td className={`${TD} text-right tabular-nums`}>{service.appointments}</td>
                <td className={`${TD} text-right tabular-nums`}>{service.completed}</td>
                {money && <td className={`${TD} text-right tabular-nums`}>{formatGbp(service.booked_value)}</td>}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
      {data.add_ons.length > 0 && (
        <p className="mt-3 text-sm text-slate-500">
          Add-ons on {formatRate(data.add_on_uptake_rate)} of bookings. Most popular:{' '}
          {data.add_ons
            .slice(0, 3)
            .map((addOn) => `${addOn.name} (${addOn.appointments})`)
            .join(', ')}
          .
        </p>
      )}
    </Panel>
  )
}

export function SourcesPanel({ sources }: { sources: Record<string, number> }) {
  const entries = Object.entries(sources).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  return (
    <Panel
      title="Where bookings came from"
      summary={
        entries[0] ? `Most came from ${(SOURCE_LABELS[entries[0][0]] ?? entries[0][0]).toLowerCase()}.` : undefined
      }
    >
      <ul className="space-y-2 text-sm">
        {entries.map(([source, count]) => (
          <li key={source} className="flex items-center justify-between gap-3">
            <span className="text-slate-700">{SOURCE_LABELS[source] ?? source}</span>
            <span className="tabular-nums text-slate-900">
              {count}
              <span className="ml-1 text-slate-400">({Math.round((count / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// --------------------------------------------------------------------------
// Advanced panels
// --------------------------------------------------------------------------

type TrendMetric = 'appointments' | 'new_customers' | 'booked_value'

export function TrendPanel({ data, money }: { data: TrendData; money: boolean }) {
  const [metric, setMetric] = useState<TrendMetric>('appointments')
  const metrics: { value: TrendMetric; label: string }[] = [
    { value: 'appointments', label: 'Appointments' },
    { value: 'new_customers', label: 'New customers' },
    ...(money ? [{ value: 'booked_value' as const, label: 'Booked value' }] : []),
  ]
  const label = metrics.find((m) => m.value === metric)?.label ?? 'Appointments'
  const format = metric === 'booked_value' ? (v: number) => formatGbp(String(v)) : (v: number) => String(v)
  const points = data.points.map((point) => ({
    label: bucketLabel(point.bucket_start, data.granularity),
    value: metric === 'booked_value' ? Number(point.booked_value ?? 0) : point[metric],
  }))
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0] ?? { label: '', value: 0 })
  const per = { day: 'day', week: 'week', month: 'month' }[data.granularity]

  return (
    <Panel
      title="Trend"
      className="lg:col-span-2"
      summary={
        peak && peak.value > 0
          ? `${label} per ${per}. Highest: ${peak.label} (${format(peak.value)}).`
          : `${label} per ${per}. Nothing in this period yet.`
      }
    >
      <fieldset className="mb-3 flex flex-wrap gap-1">
        <legend className="sr-only">Metric to chart</legend>
        {metrics.map((m) => (
          <label
            key={m.value}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${
              metric === m.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <input
              type="radio"
              name="trend-metric"
              value={m.value}
              checked={metric === m.value}
              onChange={() => setMetric(m.value)}
              className="sr-only"
            />
            {m.label}
          </label>
        ))}
      </fieldset>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-slate-100" />}>
        <TrendChart points={points} valueLabel={label} formatValue={format} />
      </Suspense>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-slate-700">
          Show as a table
        </summary>
        <ScrollTable caption={`${label} per ${per}`}>
          <thead>
            <tr>
              <th className={TH}>{per[0].toUpperCase() + per.slice(1)}</th>
              <th className={`${TH} text-right`}>{label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td className={TD}>{p.label}</td>
                <td className={`${TD} text-right tabular-nums`}>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </details>
    </Panel>
  )
}

export function HeatmapPanel({ data }: { data: Heatmap }) {
  const counts = new Map(data.cells.map((c) => [`${c.weekday}-${c.hour}`, c.appointments]))
  const hours = data.cells.map((c) => c.hour)
  const busiest = data.cells.reduce<(typeof data.cells)[number] | null>(
    (best, c) => (!best || c.appointments > best.appointments ? c : best),
    null,
  )
  const range = hours.length
    ? Array.from({ length: Math.max(...hours) - Math.min(...hours) + 1 }, (_, i) => Math.min(...hours) + i)
    : []

  return (
    <Panel
      title="Busy days and times"
      info={DEFINITIONS.heatmap}
      className="lg:col-span-2"
      summary={
        busiest
          ? `Busiest: ${WEEKDAYS[busiest.weekday - 1]}s at ${hourLabel(busiest.hour)} (${busiest.appointments} appointments).`
          : 'No appointments in this period yet.'
      }
    >
      {range.length > 0 && (
        <ScrollTable caption="Appointment starts by weekday and hour">
          <thead>
            <tr>
              <th className={TH}>
                <span className="sr-only">Day</span>
              </th>
              {range.map((hour) => (
                <th key={hour} scope="col" className={`${TH} text-center font-normal normal-case`}>
                  {hourLabel(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day, index) => (
              <tr key={day}>
                <th scope="row" className="pr-2 text-left text-xs font-medium text-slate-600">
                  {day.slice(0, 3)}
                </th>
                {range.map((hour) => {
                  const count = counts.get(`${index + 1}-${hour}`) ?? 0
                  const level = data.max ? count / data.max : 0
                  return (
                    <td key={hour} className="p-0.5">
                      <span
                        className={`flex h-9 min-w-9 items-center justify-center rounded text-xs tabular-nums ${
                          level > 0.5 ? 'text-white' : 'text-slate-700'
                        }`}
                        style={{ backgroundColor: count ? `rgba(30, 41, 59, ${0.12 + level * 0.88})` : '#f8fafc' }}
                      >
                        {count || ''}
                        <span className="sr-only">{count ? '' : '0'}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
    </Panel>
  )
}

export function StaffPanel({ rows }: { rows: StaffRow[] }) {
  return (
    <Panel
      title="Staff"
      className="lg:col-span-2"
      summary={rows[0] ? `${rows[0].name} had the most appointments (${rows[0].appointments}).` : 'No appointments in this period yet.'}
    >
      {rows.length > 0 && (
        <ScrollTable caption="Appointments by member of staff">
          <thead>
            <tr>
              <th className={TH}>Staff</th>
              <th className={`${TH} text-right`}>Appointments</th>
              <th className={`${TH} text-right`}>Completion</th>
              <th className={`${TH} text-right`}>No-show</th>
              <th className={`${TH} text-right`}>Booked value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee_id}>
                <td className={TD}>{row.name}</td>
                <td className={`${TD} text-right tabular-nums`}>{row.appointments}</td>
                <td className={`${TD} text-right tabular-nums`}>{formatRate(row.completion_rate)}</td>
                <td className={`${TD} text-right tabular-nums`}>{formatRate(row.no_show_rate)}</td>
                <td className={`${TD} text-right tabular-nums`}>{formatGbp(row.booked_value)}</td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
    </Panel>
  )
}

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DueBackList({
  garageId,
  first,
  employeeId,
}: {
  garageId: string
  first: DueBackPage
  employeeId: string | null
}) {
  const [page, setPage] = useState(1)
  const { data: fetched, isFetching } = useDueBack(page, employeeId, page > 1)
  const current = page === 1 ? first : (fetched ?? first)
  const pages = Math.max(1, Math.ceil(current.total / current.per_page))

  if (current.total === 0) {
    return <p className="text-sm text-slate-500">Nobody is due back in the next {current.due_soon_days} days.</p>
  }

  return (
    <div aria-busy={isFetching}>
      <ScrollTable caption="Customers due back">
        <thead>
          <tr>
            <th className={TH}>Customer</th>
            <th className={TH}>Service</th>
            <th className={TH}>Last visit</th>
            <th className={TH}>Due</th>
            <th className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {current.items.map((item) => (
            <tr key={`${item.customer_id}-${item.appointment_type_id}-${item.vehicle_id ?? ''}`}>
              <td className={TD}>
                <Link to={`/${garageId}/customers/${item.customer_id}`} className="font-medium text-slate-900 underline">
                  {item.customer_name}
                </Link>
              </td>
              <td className={TD}>
                {item.service_name}
                {item.vehicle_registration && (
                  <span className="ml-1 text-slate-500">({item.vehicle_registration})</span>
                )}
              </td>
              <td className={TD}>{formatDay(item.last_visit)}</td>
              <td className={TD}>
                {formatDay(item.due_date)}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'due' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.status === 'due' ? 'Due' : 'Due soon'}
                </span>
                {item.basis === 'mot_expiry' && <span className="ml-1 text-xs text-slate-500">MOT expiry</span>}
              </td>
              <td className={TD}>
                <Link
                  to={`/${garageId}/appointments/new?customer_id=${item.customer_id}`}
                  className="inline-flex min-h-11 items-center font-medium text-slate-900 underline"
                >
                  Book in<span className="sr-only"> {item.customer_name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-11 rounded-md px-3 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-11 rounded-md px-3 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export function CustomersPanel({
  data,
  garageId,
  employeeId,
}: {
  data: CustomersSection
  garageId: string
  employeeId: string | null
}) {
  const seen = data.new_customers + data.returning_customers
  const dueBack = data.due_back
  return (
    <Panel
      title="Customers"
      className="lg:col-span-2"
      summary={
        seen
          ? `${seen} customer${seen === 1 ? '' : 's'} seen: ${data.new_customers} new, ${data.returning_customers} returning.`
          : 'No completed visits in this period yet.'
      }
    >
      {seen > 0 && (
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <span className="bg-slate-800" style={{ width: `${(data.returning_customers / seen) * 100}%` }} />
          <span
            className="bg-[repeating-linear-gradient(45deg,#94a3b8_0_4px,#cbd5e1_4px_8px)]"
            style={{ width: `${(data.new_customers / seen) * 100}%` }}
          />
        </div>
      )}
      <div className="mt-5 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-slate-900">Due back</h3>
        <InfoTip label="Due back">{DEFINITIONS.dueBack}</InfoTip>
      </div>
      <p className="mb-3 mt-1 text-sm text-slate-500">
        {dueBack.due} due now, {dueBack.due_soon} due in the next {dueBack.due_soon_days} days.
      </p>
      <DueBackList key={employeeId ?? 'all'} garageId={garageId} first={dueBack} employeeId={employeeId} />
    </Panel>
  )
}
