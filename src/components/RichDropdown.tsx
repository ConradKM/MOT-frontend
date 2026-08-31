import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

export interface RichDropdownOption {
  value: string
  title: string
  description?: string
}

interface RichDropdownProps {
  id?: string
  options: RichDropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Renders a filter input inside the panel — for option lists too long to just scroll through. */
  searchable?: boolean
  searchPlaceholder?: string
}

/**
 * A combobox-style dropdown for options that need more than a plain label — each
 * option renders a title plus a muted description line below it. Not a native
 * <select>, since <option> elements can't carry that second line of styled text.
 */
export function RichDropdown({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled,
  searchable = false,
  searchPlaceholder = 'Search…',
}: RichDropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const filteredOptions =
    searchable && query.trim()
      ? options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()))
      : options

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Keep the highlighted option in view when navigating past the visible edge of the panel.
  useEffect(() => {
    if (!open) return
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, listboxId, filteredOptions.length])

  useEffect(() => {
    if (open && searchable) searchInputRef.current?.focus()
  }, [open, searchable])

  const openList = () => {
    if (disabled || options.length === 0) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const selectOption = (opt: RichDropdownOption) => {
    onChange(opt.value)
    close()
  }

  /** Shared arrow/enter/escape/tab handling for both the trigger button and the search input. */
  const navigateAndSelect = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[activeIndex]) selectOption(filteredOptions[activeIndex])
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        close()
        break
    }
  }

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList()
      }
      return
    }
    // Space selects when the button itself holds focus (non-searchable mode) — the search
    // input's keydown handler deliberately doesn't do this, since space should type there.
    if (e.key === ' ') {
      e.preventDefault()
      if (filteredOptions[activeIndex]) selectOption(filteredOptions[activeIndex])
      return
    }
    navigateAndSelect(e)
  }

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setActiveIndex(0)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
        }
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        {selected ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">{selected.title}</span>
            {selected.description && (
              <span className="block truncate text-xs text-slate-500">{selected.description}</span>
            )}
          </span>
        ) : (
          <span className="flex-1 truncate text-slate-400">{placeholder}</span>
        )}
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {searchable && (
            <div className="border-b border-slate-100 p-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={handleSearchChange}
                onKeyDown={navigateAndSelect}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}
          <ul id={listboxId} role="listbox" aria-labelledby={id} className="max-h-72 overflow-auto py-1">
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            )}
            {filteredOptions.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={opt.value === value}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // Prevent the trigger/input from blurring before the click registers.
                  e.preventDefault()
                  selectOption(opt)
                }}
                className={`cursor-pointer px-3 py-2 ${i === activeIndex ? 'bg-slate-100' : ''}`}
              >
                <p className="truncate text-sm font-medium text-slate-900">{opt.title}</p>
                {opt.description && (
                  <p className="truncate text-xs text-slate-500">{opt.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
