/**
 * Add-on selection rules, mirrored from the backend
 * (MOT-backend app/appointments/add_ons/service.py) so the UI can show the
 * live price and end time without a round trip. The server re-validates and
 * re-prices everything on submit - this is display logic, never the
 * authoritative total.
 */

/** The fields both the staff catalogue (AddOn) and the public booking payload carry. */
export interface AddOnOption {
  id: string
  name: string
  description: string | null
  /** Signed decimal string, e.g. "15.00" / "-5.50". */
  price_delta: string
  duration_delta_minutes: number
  max_quantity: number
  exclusivity_group: string | null
}

/** add-on id -> quantity (>= 1). Absent means not selected. */
export type AddOnSelection = Record<string, number>

/** Decimal string -> integer pence, so sums never pick up float error. */
export function toPence(value: string | null | undefined): number {
  if (value == null || value === '') return 0
  return Math.round(Number(value) * 100)
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatPence(pence: number): string {
  return gbp.format(pence / 100)
}

function signed(n: number, text: string): string {
  return n < 0 ? `−${text}` : `+${text}`
}

export function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes)
  if (abs < 60) return `${abs} min`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "+30 min · +£15.00" - omits whichever side is zero. */
export function formatDelta(pricePence: number, minutes: number): string {
  const parts = []
  if (minutes) parts.push(signed(minutes, formatMinutes(minutes)))
  if (pricePence) parts.push(signed(pricePence, formatPence(Math.abs(pricePence))))
  return parts.length ? parts.join(' · ') : 'No change to price or time'
}

export function formatAddOnDelta(addOn: Pick<AddOnOption, 'price_delta' | 'duration_delta_minutes'>) {
  return formatDelta(toPence(addOn.price_delta), addOn.duration_delta_minutes)
}

/**
 * Toggle an add-on on (quantity 1) or off. Selecting a member of an
 * exclusivity group deselects the group's other members - radio behaviour,
 * except that the selected one can still be cleared.
 */
export function toggleAddOn(
  selection: AddOnSelection,
  addOn: AddOnOption,
  catalogue: AddOnOption[],
): AddOnSelection {
  if (selection[addOn.id]) {
    const next = { ...selection }
    delete next[addOn.id]
    return next
  }
  return setQuantity(selection, addOn, 1, catalogue)
}

/** Set a quantity, clamped to 0..max_quantity; 0 removes it. */
export function setQuantity(
  selection: AddOnSelection,
  addOn: AddOnOption,
  quantity: number,
  catalogue: AddOnOption[],
): AddOnSelection {
  const qty = Math.max(0, Math.min(Math.floor(quantity) || 0, addOn.max_quantity))
  const next = { ...selection }
  if (qty === 0) {
    delete next[addOn.id]
    return next
  }
  if (!next[addOn.id] && addOn.exclusivity_group) {
    for (const other of catalogue) {
      if (other.id !== addOn.id && other.exclusivity_group === addOn.exclusivity_group) {
        delete next[other.id]
      }
    }
  }
  next[addOn.id] = qty
  return next
}

/** Per-unit deltas for each selected id. Deltas come from `overrides` first
 * (an existing booking's snapshot, which the server keeps on edit) and then
 * from the catalogue. Ids found in neither are ignored. */
export function addOnTotals(
  selection: AddOnSelection,
  catalogue: AddOnOption[],
  overrides: Record<string, { price_delta: string; duration_delta_minutes: number }> = {},
): { pricePence: number; minutes: number } {
  let pricePence = 0
  let minutes = 0
  for (const [id, qty] of Object.entries(selection)) {
    const source = overrides[id] ?? catalogue.find((a) => a.id === id)
    if (!source) continue
    pricePence += toPence(source.price_delta) * qty
    minutes += source.duration_delta_minutes * qty
  }
  return { pricePence, minutes }
}

export function selectionToPayload(selection: AddOnSelection) {
  return Object.entries(selection).map(([add_on_id, quantity]) => ({ add_on_id, quantity }))
}

/** The availability endpoints' `add_ons=<id>[:qty],...` query form. Sorted so
 * equal selections share one query-cache key. */
export function selectionToQuery(selection: AddOnSelection): string {
  return Object.entries(selection)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(',')
}

export function selectionCount(selection: AddOnSelection): number {
  return Object.values(selection).reduce((n, qty) => n + qty, 0)
}

export function sameSelection(a: AddOnSelection, b: AddOnSelection): boolean {
  return selectionToQuery(a) === selectionToQuery(b)
}
