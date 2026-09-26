import { useState } from 'react'
import {
  useCustomerLoyaltyHistory,
  useCustomerLoyaltyProgress,
  useRedeemLoyaltyReward,
} from '../../api/queries'
import { useToast } from '../Toast'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/datetime'
import { formatMinor } from '../../lib/money'

const ENTRY_LABELS: Record<string, string> = {
  EARN: 'Visit earned',
  REDEEM: 'Reward redeemed',
  ADJUSTMENT: 'Manual adjustment',
  REVERSAL: 'Reversal',
}

/** Staff-facing loyalty summary on a customer's detail page - progress,
 * available rewards (with a one-tap redeem), and recent history. Renders
 * nothing once loaded if the business has never enabled loyalty, so it never
 * clutters a garage that doesn't use the feature. */
export function LoyaltyCard({ customerId }: { customerId: string }) {
  const { data: progress, isLoading } = useCustomerLoyaltyProgress(customerId)
  const { data: history = [] } = useCustomerLoyaltyHistory(customerId)
  const redeem = useRedeemLoyaltyReward(customerId)
  const { showToast } = useToast()
  const [showHistory, setShowHistory] = useState(false)

  if (isLoading || !progress || !progress.enabled) return null

  const dots = Array.from({ length: progress.target }, (_, i) => i < progress.current_units)

  const handleRedeem = async (rewardId: string) => {
    if (!confirm('Redeem this reward now? This cannot be undone.')) return
    try {
      await redeem.mutateAsync(rewardId)
      showToast('Reward redeemed.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Loyalty</h2>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">{progress.program_name}</p>

        <div className="mt-2 flex items-center gap-1" aria-label="Loyalty progress">
          {dots.map((filled, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${filled ? 'bg-slate-900' : 'bg-slate-200'}`}
            />
          ))}
          <span className="ml-2 text-sm text-slate-600">
            {progress.current_units} / {progress.target} visits
          </span>
        </div>

        {progress.reward_available ? (
          <div className="mt-3 space-y-2">
            {progress.available_rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2"
              >
                <p className="text-sm font-medium text-emerald-800">
                  Reward available — {formatMinor(reward.reward_value_minor, reward.currency)} off
                </p>
                <button
                  onClick={() => handleRedeem(reward.id)}
                  disabled={redeem.isPending}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  Redeem
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {progress.target - progress.current_units === 1
              ? 'One more visit until '
              : `${progress.target - progress.current_units} more visits until `}
            {formatMinor(progress.reward_value_minor, progress.currency)} off.
          </p>
        )}

        {history.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              {showHistory ? 'Hide history' : 'Show history'}
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between">
                    <span>
                      {ENTRY_LABELS[entry.entry_type] ?? entry.entry_type}
                      {entry.reason ? ` — ${entry.reason}` : ''}
                    </span>
                    <span className="text-slate-400">{formatDateTime(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
