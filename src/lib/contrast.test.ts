import { describe, expect, it } from 'vitest'
import { MIN_CONTRAST_RATIO, contrastRatio, formatRatio, isHexColor, mixHex } from './contrast'
// Identical to MOT-backend tests/fixtures/contrast_vectors.json, so the two
// implementations are held to the same answers.
import vectors from './contrastVectors.json'

describe('contrast (shared vectors with MOT-backend)', () => {
  it('uses the same minimum as the server', () => {
    expect(vectors.min_ratio).toBe(MIN_CONTRAST_RATIO)
  })

  it.each(vectors.ratios)('$background on $text is $ratio:1', ({ background, text, ratio, passes }) => {
    const actual = contrastRatio(background, text)
    expect(Math.abs(actual - ratio)).toBeLessThan(0.005)
    expect(actual >= MIN_CONTRAST_RATIO).toBe(passes)
  })

  it.each(vectors.valid_hex)('accepts %j', (value) => {
    expect(isHexColor(value)).toBe(true)
  })

  it.each(vectors.invalid_hex)('rejects %j', (value) => {
    expect(isHexColor(value)).toBe(false)
  })
})

describe('mixHex', () => {
  it('matches color-mix(in srgb) at the ends and the middle', () => {
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#ffffff')
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('formatRatio', () => {
  it('rounds down so a failing pair never displays as passing', () => {
    expect(formatRatio(4.4781)).toBe('4.4:1')
    expect(formatRatio(4.5422)).toBe('4.5:1')
    expect(formatRatio(21)).toBe('21.0:1')
  })
})
