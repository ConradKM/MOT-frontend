import { Outlet } from 'react-router-dom'
import { useFeatureVisible } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { SectionTabs } from '../SectionTabs'

/** Insights in the top menu covers the analytics overview and the deposit
 * payments list. The old /payments URL redirects to the Payments tab (see
 * App.tsx).
 *
 * There is no `payments` plan feature yet, so the Payments tab shows unless
 * the backend ever reports `payments: false` - the same rule as every other
 * gated item (useFeatureVisible). */
export function InsightsLayout() {
  const garageId = useGarageId()
  const paymentsVisible = useFeatureVisible('payments')

  return (
    <div>
      <SectionTabs
        label="Insights sections"
        tabs={[
          { to: `/${garageId}/insights`, label: 'Overview', end: true },
          ...(paymentsVisible ? [{ to: `/${garageId}/insights/payments`, label: 'Payments' }] : []),
        ]}
      />
      <Outlet />
    </div>
  )
}
