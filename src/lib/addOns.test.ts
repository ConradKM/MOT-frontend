import { describe, expect, it } from 'vitest'
import {
  addOnTotals,
  formatDelta,
  selectionToPayload,
  selectionToQuery,
  setQuantity,
  toPence,
  toggleAddOn,
  type AddOnOption,
} from './addOns'

const opt = (patch: Partial<AddOnOption>): AddOnOption => ({
  id: 'x',
  name: 'X',
  description: null,
  price_delta: '0.00',
  duration_delta_minutes: 0,
  max_quantity: 1,
  exclusivity_group: null,
  ...patch,
})

const wash = opt({ id: 'wash', price_delta: '10.00', duration_delta_minutes: 15 })
const keys = opt({ id: 'keys', price_delta: '4.50', duration_delta_minutes: 5, max_quantity: 3 })
const standard = opt({ id: 'std', exclusivity_group: 'Speed' })
const rush = opt({ id: 'rush', price_delta: '25.00', duration_delta_minutes: -30, exclusivity_group: 'Speed' })
const catalogue = [wash, keys, standard, rush]

describe('toggleAddOn', () => {
  it('adds at quantity 1 and removes on a second toggle', () => {
    const once = toggleAddOn({}, wash, catalogue)
    expect(once).toEqual({ wash: 1 })
    expect(toggleAddOn(once, wash, catalogue)).toEqual({})
  })

  it('deselects the rest of an exclusivity group, leaving others alone', () => {
    const start = { std: 1, wash: 1 }
    expect(toggleAddOn(start, rush, catalogue)).toEqual({ rush: 1, wash: 1 })
  })

  it('lets the selected member of a group be cleared', () => {
    expect(toggleAddOn({ rush: 1 }, rush, catalogue)).toEqual({})
  })
})

describe('setQuantity', () => {
  it('clamps to the add-on maximum and removes at zero', () => {
    expect(setQuantity({}, keys, 5, catalogue)).toEqual({ keys: 3 })
    expect(setQuantity({ keys: 2 }, keys, 0, catalogue)).toEqual({})
    expect(setQuantity({ keys: 2 }, keys, -1, catalogue)).toEqual({})
  })
})

describe('addOnTotals', () => {
  it('sums quantity × signed deltas in pence and minutes', () => {
    expect(addOnTotals({ keys: 3, rush: 1 }, catalogue)).toEqual({
      pricePence: 3 * 450 + 2500,
      minutes: 3 * 5 - 30,
    })
  })

  it('prefers a saved snapshot over the current catalogue price', () => {
    const saved = { wash: { price_delta: '8.00', duration_delta_minutes: 15 } }
    expect(addOnTotals({ wash: 1 }, catalogue, saved).pricePence).toBe(800)
  })

  it('ignores ids it has no price for', () => {
    expect(addOnTotals({ gone: 2 }, catalogue)).toEqual({ pricePence: 0, minutes: 0 })
  })
})

describe('serialisation', () => {
  it('builds the submit payload and a stable availability query', () => {
    expect(selectionToPayload({ wash: 1, keys: 2 })).toEqual([
      { add_on_id: 'wash', quantity: 1 },
      { add_on_id: 'keys', quantity: 2 },
    ])
    expect(selectionToQuery({ wash: 1, keys: 2 })).toBe('keys:2,wash:1')
    expect(selectionToQuery({})).toBe('')
  })
})

describe('formatting', () => {
  it('shows signed time and price, omitting a zero side', () => {
    expect(formatDelta(1500, 30)).toBe('+30 min · +£15.00')
    expect(formatDelta(-550, 0)).toBe('−£5.50')
    expect(formatDelta(0, 90)).toBe('+1 h 30 min')
    expect(formatDelta(0, 0)).toBe('No change to price or time')
  })

  it('parses decimal strings to pence without float drift', () => {
    expect(toPence('0.29')).toBe(29)
    expect(toPence('-5.50')).toBe(-550)
    expect(toPence(null)).toBe(0)
  })
})
