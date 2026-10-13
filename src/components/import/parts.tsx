import type { ImportIssue, ImportItemStatus, ImportResult } from '../../types'

/** Small presentational pieces of an import preview. Status is always an
 * icon *and* a word, never colour alone. */

const STATUS: Record<ImportItemStatus, { icon: string; label: string; className: string }> = {
  NEW: { icon: '+', label: 'New', className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' },
  EXISTS: {
    icon: '=',
    label: 'Already exists',
    className: 'bg-slate-100 text-slate-700 ring-slate-600/15',
  },
  ERROR: { icon: '✕', label: 'Error', className: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
}

export function ItemStatusBadge({ status }: { status: ImportItemStatus }) {
  const { icon, label, className } = STATUS[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

export function WarningBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 ring-1 ring-amber-600/20 ring-inset">
      <span aria-hidden>⚠</span>
      {count === 1 ? '1 warning' : `${count} warnings`}
    </span>
  )
}

/** A row's errors and warnings, each with the JSON path it points at. */
export function IssueList({ errors, warnings }: { errors: ImportIssue[]; warnings: ImportIssue[] }) {
  if (errors.length === 0 && warnings.length === 0) return null
  return (
    <ul className="space-y-1 text-xs">
      {errors.map((issue, i) => (
        <li key={`e${i}`} className="text-rose-700">
          <span aria-hidden>✕ </span>
          <span className="sr-only">Error: </span>
          <code className="rounded bg-rose-50 px-1 break-all">{issue.path}</code> {issue.message}
        </li>
      ))}
      {warnings.map((issue, i) => (
        <li key={`w${i}`} className="text-amber-800">
          <span aria-hidden>⚠ </span>
          <span className="sr-only">Warning: </span>
          <code className="rounded bg-amber-50 px-1 break-all">{issue.path}</code> {issue.message}
        </li>
      ))}
    </ul>
  )
}

export function SummaryChips({ result }: { result: ImportResult }) {
  const { counts } = result
  const chips = [
    { label: 'New', value: counts.new, icon: '+', className: 'text-emerald-800 bg-emerald-50' },
    { label: 'Already exists', value: counts.exists, icon: '=', className: 'text-slate-700 bg-slate-100' },
    { label: 'Errors', value: counts.error, icon: '✕', className: 'text-rose-700 bg-rose-50' },
    { label: 'Warnings', value: counts.warning, icon: '⚠', className: 'text-amber-800 bg-amber-50' },
  ]
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Preview summary">
      {chips.map((chip) => (
        <li
          key={chip.label}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${chip.className}`}
        >
          <span aria-hidden>{chip.icon}</span>
          {chip.label}
          <strong className="font-semibold">{chip.value}</strong>
        </li>
      ))}
    </ul>
  )
}
