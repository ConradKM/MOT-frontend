import { apiFetch } from './client'

/**
 * Loyalty rewards and discount codes - see MOT-backend app/loyalty.
 *
 * Every Xth completed visit issues the customer a personal, single-use code
 * (LOYALTY); owners can also create promo codes (MANUAL). The server is the
 * only authority on what a code is worth on a booking - nothing here
 * computes a price.
 */

export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type DiscountSource = 'LOYALTY' | 'MANUAL'
/** Derived server-side: Disabled > Used > Expired > Active. */
export type DiscountStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'DISABLED'
export type DiscountEmailStatus = 'SENT' | 'FAILED' | 'NO_EMAIL' | 'OPTED_OUT'

export interface LoyaltySettings {
  enabled: boolean
  visits_required: number
  discount_type: DiscountType
  discount_value: string
  expiry_days: number
  enabled_at?: string | null
}

export interface DiscountCodeCustomer {
  id: string
  first_name: string
  last_name: string
  email: string | null
  marketing_email_opt_out: boolean
}

export interface DiscountCode {
  id: string
  code: string
  source: DiscountSource
  discount_type: DiscountType
  discount_value: string
  status: DiscountStatus
  /** What the owner set - ACTIVE or DISABLED. */
  stored_status: 'ACTIVE' | 'DISABLED'
  uses: number
  max_uses: number | null
  max_uses_per_customer: number | null
  valid_from: string | null
  expires_at: string | null
  customer: DiscountCodeCustomer | null
  issued_for_visit_count: number | null
  email_status: DiscountEmailStatus | null
  emailed_at: string | null
  created_at: string
}

export interface DiscountCodePage {
  items: DiscountCode[]
  total: number
}

export interface DiscountCodeListParams {
  source?: DiscountSource
  status?: DiscountStatus
  search?: string
  limit?: number
  offset?: number
}

export interface DiscountCodeCreateInput {
  /** Blank to have one generated. */
  code?: string | null
  discount_type: DiscountType
  discount_value: string
  valid_from?: string | null
  expires_at?: string | null
  max_uses?: number | null
  max_uses_per_customer?: number | null
}

export interface DiscountCodeUpdateInput {
  status?: 'ACTIVE' | 'DISABLED'
  valid_from?: string | null
  expires_at?: string | null
  max_uses?: number | null
  max_uses_per_customer?: number | null
}

export interface DiscountPreview {
  code: string
  discount_type: DiscountType
  discount_value: string
  original_total: string
  discount_amount: string
  new_total: string
}

export interface DiscountPreviewInput {
  code: string
  customer_id: string
  appointment_type_id: string
  add_ons: { add_on_id: string; quantity: number }[]
  appointment_id?: string | null
}

export interface CustomerLoyaltySummary {
  enabled: boolean
  visits_required: number | null
  completed_visits: number
  visits_to_next_reward: number | null
  marketing_email_opt_out: boolean
  codes: DiscountCode[]
}

export function getLoyaltySettings(): Promise<LoyaltySettings> {
  return apiFetch<LoyaltySettings>('/api/loyalty/settings')
}

export function updateLoyaltySettings(data: LoyaltySettings): Promise<LoyaltySettings> {
  return apiFetch<LoyaltySettings>('/api/loyalty/settings', { method: 'PUT', body: data })
}

export function listDiscountCodes(params: DiscountCodeListParams = {}): Promise<DiscountCodePage> {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const query = qs.toString()
  return apiFetch<DiscountCodePage>(`/api/loyalty/codes${query ? `?${query}` : ''}`)
}

export function createDiscountCode(data: DiscountCodeCreateInput): Promise<DiscountCode> {
  return apiFetch<DiscountCode>('/api/loyalty/codes', { method: 'POST', body: data })
}

export function updateDiscountCode(id: string, data: DiscountCodeUpdateInput): Promise<DiscountCode> {
  return apiFetch<DiscountCode>(`/api/loyalty/codes/${id}`, { method: 'PATCH', body: data })
}

export function resendDiscountCodeEmail(id: string): Promise<DiscountCode> {
  return apiFetch<DiscountCode>(`/api/loyalty/codes/${id}/resend`, { method: 'POST' })
}

/** Staff preview for the appointment form - advisory; saving re-checks. */
export function previewDiscount(data: DiscountPreviewInput): Promise<DiscountPreview> {
  return apiFetch<DiscountPreview>('/api/loyalty/evaluate', { method: 'POST', body: data })
}

export function getCustomerLoyalty(customerId: string): Promise<CustomerLoyaltySummary> {
  return apiFetch<CustomerLoyaltySummary>(`/api/loyalty/customers/${customerId}`)
}

export interface UnsubscribeResult {
  business_name: string
  unsubscribed: boolean
}

/** Which business an unsubscribe link is for - changes nothing. */
export function previewUnsubscribe(token: string): Promise<UnsubscribeResult> {
  return apiFetch<UnsubscribeResult>('/api/public/marketing/unsubscribe/preview', {
    method: 'POST',
    body: { token },
    skipAuth: true,
  })
}

export function unsubscribe(token: string): Promise<UnsubscribeResult> {
  return apiFetch<UnsubscribeResult>('/api/public/marketing/unsubscribe', {
    method: 'POST',
    body: { token },
    skipAuth: true,
  })
}

/** "10% off" / "£5.00 off" - display only. */
export function discountLabel(type: DiscountType, value: string): string {
  if (type === 'PERCENTAGE') return `${Number(value).toString()}% off`
  return `£${Number(value).toFixed(2)} off`
}
