import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

export interface SettingsTab {
  key: string
  label: string
}

/**
 * The active tab, kept in the URL (`?tab=key`) so a tab can be deep-linked
 * and the back button steps between tabs. An unknown or missing value falls
 * back to a hash alias, then to the first tab.
 */
export function useTabParam<K extends string>(
  keys: readonly K[],
  /** Old in-page anchors (`#phone-menu`) that should still land on a tab. */
  hashAliases: Record<string, K> = {},
): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const raw = params.get('tab') ?? hashAliases[hash.replace(/^#/, '')] ?? null
  const active = (keys as readonly string[]).includes(raw ?? '') ? (raw as K) : keys[0]
  const setActive = (key: K) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', key)
      return next
    })
  }
  return [active, setActive]
}

/**
 * An accessible tab bar (WAI-ARIA tabs pattern, automatic activation): one
 * tab in the tab order at a time, arrow keys / Home / End move between them.
 * Scrolls sideways on a narrow screen rather than wrapping, with 44px-tall
 * targets on touch.
 */
export function SettingsTabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
  children,
}: {
  tabs: readonly { key: K; label: string }[]
  active: K
  onChange: (key: K) => void
  label: string
  children: ReactNode
}) {
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = (key: string) => `${baseId}-tab-${key}`
  const panelId = (key: string) => `${baseId}-panel-${key}`

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next === null) return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(tabs[next].key)
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t, i) => {
          const selected = t.key === active
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={tabId(t.key)}
              aria-selected={selected}
              aria-controls={panelId(t.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 ${
                selected
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(active)}
        aria-labelledby={tabId(active)}
        className="mt-6"
      >
        {children}
      </div>
    </>
  )
}
