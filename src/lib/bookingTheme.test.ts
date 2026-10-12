import { afterEach, describe, expect, it, vi } from 'vitest'
import { MIN_CONTRAST_RATIO, contrastRatio } from './contrast'
import {
  BOOKING_THEME_PRESETS,
  DEFAULT_BACKGROUND,
  DEFAULT_TEXT,
  readCachedBookingColors,
  resolveBookingTheme,
  writeCachedBookingColors,
} from './bookingTheme'

afterEach(() => vi.restoreAllMocks())

describe('resolveBookingTheme', () => {
  it('is null (the default look) for an unset pair', () => {
    expect(resolveBookingTheme(null, null)).toBeNull()
    expect(resolveBookingTheme(undefined, undefined)).toBeNull()
  })

  it.each([
    ['#000000', null],
    ['#fff', '#000000'],
    ['red', '#ffffff'],
    ['#000000;}body{', '#ffffff'],
  ])('is null for an invalid pair (%j, %j)', (bg, fg) => {
    expect(resolveBookingTheme(bg, fg)).toBeNull()
  })

  it('is null when the pair fails contrast', () => {
    expect(resolveBookingTheme('#ffffff', '#777777')).toBeNull()
  })

  it('maps a valid pair onto the page variables, lowercased', () => {
    const theme = resolveBookingTheme('#0B1F3A', '#F5F7FA')
    expect(theme).toMatchObject({
      '--page-bg': '#0b1f3a',
      '--page-fg': '#f5f7fa',
      '--page-strong': '#f5f7fa',
      '--page-control': '#ffffff',
    })
  })

  it.each([
    ['#0b1f3a', '#f5f7fa'],
    ['#ffffff', '#767676'], // only just passes - muted text must be nudged
    ['#000000', '#949494'],
    ['#fefce8', '#1e3a8a'],
  ])('derives muted text that still passes contrast on %s / %s', (bg, fg) => {
    const theme = resolveBookingTheme(bg, fg)!
    expect(contrastRatio(theme['--page-muted'], bg)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    expect(theme['--page-faint']).toBe(theme['--page-muted'])
  })

  it('every preset and the default pair pass', () => {
    for (const p of BOOKING_THEME_PRESETS) {
      expect(contrastRatio(p.background, p.text), p.name).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    }
    expect(contrastRatio(DEFAULT_BACKGROUND, DEFAULT_TEXT)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
  })
})

describe('cached booking colours', () => {
  it('round-trips per business and clears on null', () => {
    writeCachedBookingColors('g1', { background: '#0b1f3a', text: '#f5f7fa' })
    expect(readCachedBookingColors('g1')).toEqual({ background: '#0b1f3a', text: '#f5f7fa' })
    expect(readCachedBookingColors('g2')).toBeNull()

    writeCachedBookingColors('g1', null)
    expect(readCachedBookingColors('g1')).toBeNull()
  })

  it('ignores a corrupt or tampered value', () => {
    localStorage.setItem('comaz:booking-theme:g1', '{not json')
    expect(readCachedBookingColors('g1')).toBeNull()
    localStorage.setItem('comaz:booking-theme:g1', JSON.stringify({ background: 'red', text: '#fff' }))
    expect(readCachedBookingColors('g1')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => writeCachedBookingColors('g1', { background: '#000000', text: '#ffffff' })).not.toThrow()
    expect(readCachedBookingColors('g1')).toBeNull()
  })
})
