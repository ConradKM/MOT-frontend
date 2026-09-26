import { apiFetch } from './client'

/**
 * Loyalty / rewards programme - see MOT-backend app/loyalty.
 *
 * One programme per business. "Units" are qualifying visits for the only
 * programme type built so far (VISIT) - a customer earns `earn_per_visit`
 * units each time a booked appointment or walk-in queue visit is completed,
 * and unlocks a reward every `threshold` units.
 */

export type LoyaltyProgramType = 'VISIT'
export type LoyaltyRewardType = 'FIXED_DISCOUNT'
export type LoyaltyRewardStatus = 'AVAILABLE' | 'REDEEMED' | 'CANCELLED'
export type LoyaltyEntryType = 'EARN' | 'REDEEM' | 'ADJUSTMENT' | 'REVERSAL'

export interface LoyaltyProgram {
  id: string
  garage_id: string
  enabled: boolean
  name: string
  description: string | null
  program_type: LoyaltyProgramType
  earn_per_visit: number
  threshold: number
  reward_type: LoyaltyRewardType
  reward_value_minor: number
  currency: string
  qualifying_appointment_type_ids: string[] | null
  min_spend_minor: number | null
  created_at: string
  updated_at: string
}

export type LoyaltyProgramInput = Partial<
  Omit<LoyaltyProgram, 'id' | 'garage_id' | 'created_at' | 'updated_at'>
>

export interface LoyaltyReward {
  id: string
  cycle_number: number
  status: LoyaltyRewardStatus
  reward_type: LoyaltyRewardType
  reward_value_minor: number
  currency: string
  created_at: string
  redeemed_at: string | null
}

export interface LoyaltyProgress {
  enabled: boolean
  program_name: string
  description: string | null
  current_units: number
  target: number
  remaining: number
  lifetime_units: number
  reward_available: boolean
  reward_type: LoyaltyRewardType
  reward_value_minor: number
  currency: string
  available_rewards: LoyaltyReward[]
}

export interface LoyaltyLedgerEntry {
  id: string
  entry_type: LoyaltyEntryType
  units: number
  source_type: 'APPOINTMENT' | 'REWARD' | 'MANUAL'
  source_id: string | null
  reason: string | null
  created_at: string
}

export function getLoyaltyProgram(): Promise<LoyaltyProgram> {
  return apiFetch<LoyaltyProgram>('/api/loyalty/program')
}

export function updateLoyaltyProgram(data: LoyaltyProgramInput): Promise<LoyaltyProgram> {
  return apiFetch<LoyaltyProgram>('/api/loyalty/program', { method: 'PATCH', body: data })
}

export function getCustomerLoyaltyProgress(customerId: string): Promise<LoyaltyProgress> {
  return apiFetch<LoyaltyProgress>(`/api/loyalty/customers/${customerId}/progress`)
}

export function getCustomerLoyaltyHistory(customerId: string): Promise<LoyaltyLedgerEntry[]> {
  return apiFetch<LoyaltyLedgerEntry[]>(`/api/loyalty/customers/${customerId}/history`)
}

export function adjustCustomerLoyalty(
  customerId: string,
  data: { delta: number; reason: string },
): Promise<LoyaltyLedgerEntry> {
  return apiFetch<LoyaltyLedgerEntry>(`/api/loyalty/customers/${customerId}/adjust`, {
    method: 'POST',
    body: data,
  })
}

export function redeemLoyaltyReward(customerId: string, rewardId: string): Promise<LoyaltyReward> {
  return apiFetch<LoyaltyReward>(
    `/api/loyalty/customers/${customerId}/rewards/${rewardId}/redeem`,
    { method: 'POST' },
  )
}
