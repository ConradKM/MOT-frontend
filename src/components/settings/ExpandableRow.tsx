import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'

/**
 * Tables whose rows edit in place without moving anything.
 *
 * Clicking a row's Edit leaves the summary row exactly where it is and opens
 * a white panel in a new row directly beneath it. Two things keep the header
 * still: the table is `table-fixed` with an explicit <colgroup> (so a wide
 * form can't rebalance the columns), and it scrolls inside its own wrapper
 * on a phone rather than widening the page.
 *
 * Usage:
 *
 *   <SettingsTable columns={['w-1/3', 'w-1/4', undefined, 'w-40']} head={...}>
 *     {rows.map((r) => (
 *       <ExpandableRow key={r.id} colSpan={4} expanded={editingId === r.id}
 *         onClose={() => setEditingId(null)}
 *         summary={(toggle) => (<>
 *           <td>…</td>
 *           <td><ExpandToggle {...toggle} onClick={() => setEditingId(...)} /></td>
 *         </>)}>
 *         <EditForm … />
 *       </ExpandableRow>
 *     ))}
 *   </SettingsTable>
 *
 * One row open at a time is the caller's state (a single `editingId`).
 */

export function SettingsTable({
  columns,
  head,
  children,
  minWidth = 'min-w-[40rem]',
  label,
}: {
  /** One width class per column (`w-40`, `w-1/3`); undefined takes the rest. */
  columns: (string | undefined)[]
  head: ReactNode
  children: ReactNode
  /** Below this the table scrolls sideways inside its wrapper. */
  minWidth?: string
  label?: string
}) {
  return (
    // `relative` so absolutely positioned content (an sr-only header label)
    // is clipped by this scroller instead of widening the page.
    <div className="relative overflow-x-auto rounded-lg bg-white shadow-card">
      <table className={`w-full table-fixed text-left text-sm ${minWidth}`} aria-label={label}>
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} className={c} />
          ))}
        </colgroup>
        {/* A dark header row: the page itself is light grey, so a light-grey
            header would read as page showing through the card. */}
        <thead className="bg-slate-800 text-xs uppercase tracking-wide text-white">
          {head}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/**
 * Focus for anything that expands an editor in place: into the first field
 * when it opens, back to the control that opened it when it closes. Shared
 * by ExpandableRow and the card/heading editors that follow the same rule.
 */
export function useExpandFocus(
  expanded: boolean,
  panelRef: RefObject<HTMLElement | null>,
  toggleRef: RefObject<HTMLElement | null>,
) {
  const wasExpanded = useRef(expanded)
  useEffect(() => {
    if (expanded && !wasExpanded.current) {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
        )
        ?.focus()
    } else if (!expanded && wasExpanded.current) {
      // Only reclaim focus that the closing panel took with it - not focus
      // the user has since moved to another row's Edit button.
      const active = document.activeElement
      if (!active || active === document.body) toggleRef.current?.focus()
    }
    wasExpanded.current = expanded
  }, [expanded, panelRef, toggleRef])
}

/** Escape closes an expanded editor - and only that editor. */
export function closeOnEscape(onClose: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }
}

/** The white, left-accented surface an expanded editor sits on. */
export const EXPAND_PANEL_CLASS =
  'min-w-0 animate-step-in rounded-lg border-l-4 border-slate-900 bg-white p-4 shadow-card'

export interface ExpandToggleProps {
  ref: RefObject<HTMLButtonElement | null>
  'aria-expanded': boolean
  'aria-controls': string | undefined
}

export function ExpandableRow({
  colSpan,
  expanded,
  onClose,
  summary,
  children,
  label,
}: {
  colSpan: number
  expanded: boolean
  onClose: () => void
  /** The summary row's cells. Spread `toggle` onto the Edit button. */
  summary: (toggle: ExpandToggleProps) => ReactNode
  children: ReactNode
  /** Accessible name for the panel, e.g. "Edit MOT test". */
  label?: string
}) {
  const panelId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useExpandFocus(expanded, panelRef, toggleRef)
  const onKeyDown = closeOnEscape(onClose)

  return (
    <>
      <tr
        data-expanded={expanded || undefined}
        className={`border-b border-slate-100 last:border-0 ${
          expanded ? 'bg-white shadow-[inset_4px_0_0_var(--color-slate-900)]' : ''
        }`}
      >
        {summary({
          ref: toggleRef,
          'aria-expanded': expanded,
          'aria-controls': expanded ? panelId : undefined,
        })}
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-white last:border-0">
          <td colSpan={colSpan} className="p-2 sm:p-3">
            <div
              ref={panelRef}
              id={panelId}
              role="region"
              aria-label={label}
              onKeyDown={onKeyDown}
              className={EXPAND_PANEL_CLASS}
            >
              {children}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** The Edit / Close toggle for an ExpandableRow. */
export function ExpandToggle({
  ref,
  onClick,
  label = 'Edit',
  closeLabel = 'Close',
  className = '',
  ...aria
}: ExpandToggleProps & {
  onClick: () => void
  label?: string
  closeLabel?: string
  className?: string
}) {
  const expanded = aria['aria-expanded']
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      {...aria}
      className={`inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-slate-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 sm:min-h-0 sm:py-1 ${className}`}
    >
      {expanded ? closeLabel : label}
    </button>
  )
}

/** Header cell with the shared padding. */
export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>
}

/** Body cell whose content may shrink - long names wrap, never widen a column. */
export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`min-w-0 break-words px-4 py-2 align-middle ${className}`}>{children}</td>
}
