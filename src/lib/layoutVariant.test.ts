import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUT_VARIANT,
  LAYOUT_VARIANTS,
  isKnownLayoutVariant,
  resolveLayoutVariant,
} from './layoutVariant'

describe('layout variant registry', () => {
  it('is keyed by strings and contains the default', () => {
    expect(Object.keys(LAYOUT_VARIANTS).every((k) => typeof k === 'string')).toBe(true)
    expect(LAYOUT_VARIANTS[DEFAULT_LAYOUT_VARIANT]).toBeDefined()
  })

  it('recognises only registered variants', () => {
    expect(isKnownLayoutVariant('default')).toBe(true)
    expect(isKnownLayoutVariant('bespoke-nope')).toBe(false)
    expect(isKnownLayoutVariant(null)).toBe(false)
    expect(isKnownLayoutVariant(undefined)).toBe(false)
  })

  it('resolves to the shared default for null / unknown / missing', () => {
    expect(resolveLayoutVariant(null)).toBe(DEFAULT_LAYOUT_VARIANT)
    expect(resolveLayoutVariant({ layout_variant: null })).toBe(DEFAULT_LAYOUT_VARIANT)
    expect(resolveLayoutVariant({ layout_variant: 'ghost' })).toBe(DEFAULT_LAYOUT_VARIANT)
  })

  it('resolves a registered variant to itself', () => {
    expect(resolveLayoutVariant({ layout_variant: 'default' })).toBe('default')
  })
})
