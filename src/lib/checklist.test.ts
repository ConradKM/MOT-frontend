import { describe, expect, it } from 'vitest'
import { humanizeResultOption, resultOptionClasses, resultOptionLabel } from './checklist'

describe('humanizeResultOption', () => {
  it('uses the curated label for a built-in option', () => {
    expect(humanizeResultOption('NOT_APPLICABLE')).toBe('N/A')
    expect(humanizeResultOption('CUSTOMER_DECLINED')).toBe('Customer declined')
    expect(humanizeResultOption('PASS')).toBe('Pass')
  })

  it('humanises a garage’s own custom option rather than showing the raw key', () => {
    // A business can define any result_options it likes; an unknown value must
    // still be readable in the UI.
    expect(humanizeResultOption('SOME_CUSTOM_VALUE')).toBe('Some custom value')
    expect(humanizeResultOption('REDO')).toBe('Redo')
  })

  it('handles a single-word and an already-lowercase custom option', () => {
    expect(humanizeResultOption('X')).toBe('X')
    expect(humanizeResultOption('needs_parts')).toBe('Needs parts')
  })

  it('returns an empty string unchanged instead of throwing', () => {
    expect(humanizeResultOption('')).toBe('')
  })
})

describe('resultOptionLabel / resultOptionClasses', () => {
  it('labels a status the same way the humaniser does', () => {
    expect(resultOptionLabel('DANGEROUS')).toBe('Dangerous')
  })

  it('gives the DVSA-style severities visually distinct classes', () => {
    // Locked in deliberately (MOT-backend #8): a pass must never read like a
    // failure, so these three must differ from each other.
    const pass = resultOptionClasses('PASS')
    const advisory = resultOptionClasses('ADVISORY')
    const major = resultOptionClasses('MAJOR')
    expect(new Set([pass, advisory, major]).size).toBe(3)
  })

  it('reuses the equivalent severity for the renamed statuses', () => {
    expect(resultOptionClasses('RECTIFIED')).toBe(resultOptionClasses('PASS'))
    expect(resultOptionClasses('RECOMMENDED')).toBe(resultOptionClasses('ADVISORY'))
    expect(resultOptionClasses('CUSTOMER_DECLINED')).toBe(resultOptionClasses('MINOR'))
  })

  it('falls back to a neutral badge for a custom status', () => {
    expect(resultOptionClasses('SOME_CUSTOM_VALUE')).toBe('bg-slate-200 text-slate-700')
  })
})
