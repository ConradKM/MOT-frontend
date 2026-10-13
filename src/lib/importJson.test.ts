import { describe, expect, it } from 'vitest'
import { checkJson, fillPrompt, lineColumn, stripCodeFence } from './importJson'

describe('checkJson', () => {
  it('treats an empty box as nothing to check, not an error', () => {
    expect(checkJson('   \n')).toEqual({ ok: null })
  })

  it('parses valid JSON', () => {
    expect(checkJson('{"services": []}')).toEqual({ ok: true, value: { services: [] } })
  })

  it('reports the line and column of a syntax error', () => {
    const result = checkJson('{\n  "services": [\n    {"name": "MOT",}\n  ]\n}')
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.line).toBe(3)
      expect(result.column).toBeGreaterThan(1)
    }
  })

  it('accepts JSON wrapped in a markdown code fence', () => {
    expect(checkJson('```json\n{"services": []}\n```')).toEqual({
      ok: true,
      value: { services: [] },
    })
  })
})

describe('stripCodeFence', () => {
  it('leaves unfenced text alone', () => {
    expect(stripCodeFence('{"a": 1}')).toBe('{"a": 1}')
  })
})

describe('lineColumn', () => {
  it('counts lines and columns from 1', () => {
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 })
  })
})

describe('fillPrompt', () => {
  it('fills every placeholder with real values', () => {
    const filled = fillPrompt('{{service_names}} | {{timezone}} | {{statuses}}', {
      service_names: ['MOT', 'Full service'],
      timezone: 'Europe/London',
      statuses: ['BOOKED'],
    })
    expect(filled).toBe('"MOT", "Full service" | Europe/London | "BOOKED"')
  })

  it('says when there are no names yet rather than leaving a placeholder', () => {
    expect(fillPrompt('Have: {{service_names}}', {})).toBe('Have: (none yet)')
  })
})
