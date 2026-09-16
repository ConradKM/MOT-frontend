import { apiFetch } from './client'
import type { Feedback, FeedbackPriority, FeedbackType } from '../types'

export interface FeedbackInput {
  type: FeedbackType
  message: string
  subject?: string | null
  priority?: FeedbackPriority
  /** Overrides the signed-in employee's own email for this submission. */
  email?: string | null
}

/** Business Dashboard Help Centre submission. Deliberately carries no
 * business/user id - the backend derives both from the authenticated
 * employee, so a business can never submit feedback under another tenant. */
export function createFeedback(data: FeedbackInput): Promise<Feedback> {
  return apiFetch<Feedback>('/api/feedback/', { method: 'POST', body: data })
}
