import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  addOnTotals,
  formatAddOnDelta,
  formatDelta,
  selectionCount,
  setQuantity,
  toggleAddOn,
  type AddOnOption,
  type AddOnSelection,
} from '../../lib/addOns'
import {
  richFieldBoxClass,
  richFieldDisabledClass,
  richFieldFocusClass,
} from '../rich/richFieldStyles'

interface AddOnPickerProps {
  id?: string
  addOns: AddOnOption[]
  value: AddOnSelection
  onChange: (next: AddOnSelection) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * A multi-select dropdown for a service's add-ons. Unlike RichDropdown (a
 * single-select combobox) each row can be toggled independently, carries a
 * quantity stepper when it can be added more than once, and behaves like a
 * radio within its exclusivity group. The panel stays mounted so it can
 * animate out as well as in; `inert` keeps it out of reach while closed.
 */
export function AddOnPicker({
  id,
  addOns,
  value,
  onChange,
  disabled,
  placeholder = 'Add extras…',
}: AddOnPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
  }, [open])

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
    }
  }

  const count = selectionCount(value)
  const totals = addOnTotals(value, addOns)
  const selectedNames = addOns.filter((a) => value[a.id]).map((a) =>
    value[a.id] > 1 ? `${value[a.id]}× ${a.name}` : a.name,
  )

  const ungrouped = addOns.filter((a) => !a.exclusivity_group)
  const groups = new Map<string, AddOnOption[]>()
  for (const a of addOns) {
    if (!a.exclusivity_group) continue
    groups.set(a.exclusivity_group, [...(groups.get(a.exclusivity_group) ?? []), a])
  }

  const renderRow = (addOn: AddOnOption, groupName: string | null) => {
    const qty = value[addOn.id] ?? 0
    const selected = qty > 0
    const delta = formatAddOnDelta(addOn)

    if (addOn.max_quantity > 1) {
      return (
        <li
          key={addOn.id}
          className={`flex items-center gap-3 rounded-md px-3 py-2 ${selected ? 'bg-slate-50' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{addOn.name}</p>
            <p className="truncate text-xs text-slate-500">
              {delta} each · up to {addOn.max_quantity}
            </p>
          </div>
          <div className="flex items-center rounded-md border border-slate-300">
            <button
              type="button"
              aria-label={`Remove one ${addOn.name}`}
              disabled={qty === 0}
              onClick={() => onChange(setQuantity(value, addOn, qty - 1, addOns))}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              −
            </button>
            <span
              aria-label={`${addOn.name} quantity`}
              aria-live="polite"
              className="w-7 text-center text-sm tabular-nums text-slate-900"
            >
              {qty}
            </span>
            <button
              type="button"
              aria-label={`Add one ${addOn.name}`}
              disabled={qty >= addOn.max_quantity}
              onClick={() => onChange(setQuantity(value, addOn, qty + 1, addOns))}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </li>
      )
    }

    return (
      <li key={addOn.id}>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-slate-50 ${selected ? 'bg-slate-50' : ''}`}
        >
          <input
            type={groupName ? 'radio' : 'checkbox'}
            name={groupName ? `${panelId}-${groupName}` : undefined}
            checked={selected}
            // A radio only fires change when becoming checked; onClick also
            // lets the selected one be cleared, so a group can be left empty.
            onChange={() => {
              if (!selected) onChange(toggleAddOn(value, addOn, addOns))
            }}
            onClick={() => {
              if (selected) onChange(toggleAddOn(value, addOn, addOns))
            }}
            className="mt-0.5 h-4 w-4 accent-slate-900"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">{addOn.name}</span>
            {addOn.description && (
              <span className="block truncate text-xs text-slate-500">{addOn.description}</span>
            )}
          </span>
          <span className="shrink-0 text-xs font-medium text-slate-600">{delta}</span>
        </label>
      </li>
    )
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled || addOns.length === 0}
        onClick={() => (open ? close(false) : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex items-center justify-between gap-2 ${richFieldBoxClass} ${richFieldFocusClass} ${richFieldDisabledClass}`}
      >
        {count > 0 ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">
              {selectedNames.join(', ')}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {formatDelta(totals.pricePence, totals.minutes)}
            </span>
          </span>
        ) : (
          <span className="flex-1 truncate text-slate-400">
            {addOns.length === 0 ? 'No extras offered for this service' : placeholder}
          </span>
        )}
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
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

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Add-ons"
        aria-hidden={!open}
        inert={!open}
        className={`absolute z-20 mt-1 w-full origin-top rounded-md border border-slate-200 bg-white shadow-lg transition duration-150 ease-out motion-reduce:transition-none ${
          open
            ? 'visible translate-y-0 scale-100 opacity-100'
            : 'invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <div className="max-h-80 overflow-auto p-1">
          {ungrouped.length > 0 && <ul>{ungrouped.map((a) => renderRow(a, null))}</ul>}
          {[...groups.entries()].map(([group, members]) => (
            <fieldset key={group} className="mt-1 border-t border-slate-100 pt-1 first:mt-0 first:border-0 first:pt-0">
              <legend className="px-3 pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                {group} · choose one
              </legend>
              <ul>{members.map((a) => renderRow(a, group))}</ul>
            </fieldset>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
          <p className="text-xs text-slate-500" aria-live="polite">
            {count > 0 ? formatDelta(totals.pricePence, totals.minutes) : 'Nothing added'}
          </p>
          <button
            type="button"
            onClick={() => close()}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
