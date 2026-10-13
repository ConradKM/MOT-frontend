import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ImportResult } from '../../types'
import { Button } from './controls'
import { hasProblem } from '../../lib/importDisplay'
import { AppointmentCard } from './AppointmentCard'
import { ImportCalendar } from './ImportCalendar'

/** An appointments preview: a List | Calendar toggle over the same rows,
 * optionally narrowed to the rows with problems. */

const PAGE = 100

export function AppointmentsPreview({ result }: { result: ImportResult }) {
  const id = useId()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const items = useMemo(
    () => (problemsOnly ? result.items.filter(hasProblem) : result.items),
    [result.items, problemsOnly],
  )

  const views = ['list', 'calendar'] as const
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length
    setView(views[next])
    tabs.current[next]?.focus()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Preview view" className="inline-flex rounded-md border border-slate-300 p-0.5">
          {views.map((key, index) => (
            <button
              key={key}
              ref={(el) => {
                tabs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${key}`}
              aria-controls={`${id}-panel`}
              aria-selected={view === key}
              tabIndex={view === key ? 0 : -1}
              onClick={() => setView(key)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={`min-h-11 rounded px-4 text-sm font-medium ${
                view === key ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {key === 'list' ? 'List' : 'Calendar'}
            </button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4"
            checked={problemsOnly}
            onChange={(event) => setProblemsOnly(event.target.checked)}
          />
          Problems only
        </label>
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${view}`}>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
            {problemsOnly ? 'No problems found.' : 'No appointments in this paste.'}
          </p>
        ) : view === 'list' ? (
          <>
            <ul className="space-y-2">
              {items.slice(0, shown).map((item) => (
                <li
                  key={item.index}
                  className={`rounded-lg border p-3 ${
                    item.status === 'ERROR'
                      ? 'border-rose-300 bg-rose-50/40'
                      : item.warnings.length > 0
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-slate-200'
                  }`}
                >
                  <AppointmentCard item={item} />
                </li>
              ))}
            </ul>
            {items.length > shown ? (
              <Button type="button" className="mt-3 min-h-11" onClick={() => setShown(shown + PAGE)}>
                Show {Math.min(PAGE, items.length - shown)} more of {items.length - shown}
              </Button>
            ) : null}
          </>
        ) : (
          <ImportCalendar items={items} />
        )}
      </div>
    </div>
  )
}
