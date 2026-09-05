import { describe, expect, it } from 'vitest'
import {
  callStatusLabel,
  counterpartLabel,
  formatCallDuration,
  isMissedCall,
  stripWhatsAppPrefix,
  whatsappStatusLabel,
} from './communications'

describe('isMissedCall', () => {
  it('is true for an inbound call that never connected', () => {
    expect(isMissedCall({ direction: 'INBOUND', status: 'no-answer' })).toBe(true)
    expect(isMissedCall({ direction: 'INBOUND', status: 'busy' })).toBe(true)
    expect(isMissedCall({ direction: 'INBOUND', status: 'failed' })).toBe(true)
    expect(isMissedCall({ direction: 'INBOUND', status: 'canceled' })).toBe(true)
  })

  it('is false for a completed inbound call', () => {
    expect(isMissedCall({ direction: 'INBOUND', status: 'completed' })).toBe(false)
  })

  it('is false for an outbound call with the same status - only the garage can "miss" a call', () => {
    expect(isMissedCall({ direction: 'OUTBOUND', status: 'no-answer' })).toBe(false)
  })
})

describe('callStatusLabel', () => {
  it('labels a missed call as MISSED regardless of the raw status', () => {
    expect(callStatusLabel({ direction: 'INBOUND', status: 'no-answer' })).toBe('Missed')
  })

  it('maps a known status to a clean label', () => {
    expect(callStatusLabel({ direction: 'OUTBOUND', status: 'completed' })).toBe('Completed')
  })

  it('falls back to the raw status for anything unrecognised', () => {
    expect(callStatusLabel({ direction: 'OUTBOUND', status: 'weird-status' })).toBe('weird-status')
  })
})

describe('whatsappStatusLabel', () => {
  it('maps known statuses to clean labels', () => {
    expect(whatsappStatusLabel('delivered')).toBe('Delivered')
    expect(whatsappStatusLabel('read')).toBe('Read')
    expect(whatsappStatusLabel('SKIPPED_NOT_CONFIGURED')).toMatch(/not connected/i)
  })
})

describe('formatCallDuration', () => {
  it('formats seconds as minutes and seconds', () => {
    expect(formatCallDuration(142)).toBe('2m 22s')
  })

  it('formats under a minute as seconds only', () => {
    expect(formatCallDuration(45)).toBe('45s')
  })

  it('shows a dash when there is no duration', () => {
    expect(formatCallDuration(null)).toBe('—')
  })
})

describe('stripWhatsAppPrefix', () => {
  it('removes the whatsapp: prefix', () => {
    expect(stripWhatsAppPrefix('whatsapp:+447123400001')).toBe('+447123400001')
  })

  it('leaves a plain number untouched', () => {
    expect(stripWhatsAppPrefix('+447123400001')).toBe('+447123400001')
  })

  it('passes through null/undefined', () => {
    expect(stripWhatsAppPrefix(null)).toBeNull()
    expect(stripWhatsAppPrefix(undefined)).toBeNull()
  })
})

describe('counterpartLabel', () => {
  it('prefers the matched customer name over the raw number', () => {
    const label = counterpartLabel({
      customer: { first_name: 'Oliver', last_name: 'Bennett' },
      direction: 'INBOUND',
      from_address: 'whatsapp:+447123400001',
      to_address: 'whatsapp:+14155238886',
    })
    expect(label).toBe('Oliver Bennett')
  })

  it('falls back to the counterpart number, stripped of the whatsapp: prefix', () => {
    const label = counterpartLabel({
      customer: null,
      direction: 'INBOUND',
      from_address: 'whatsapp:+447123499999',
      to_address: 'whatsapp:+14155238886',
    })
    expect(label).toBe('+447123499999')
  })

  it('uses the to_address for an outbound communication', () => {
    const label = counterpartLabel({
      customer: null,
      direction: 'OUTBOUND',
      from_address: '+441234567890',
      to_address: '+447123400001',
    })
    expect(label).toBe('+447123400001')
  })
})
