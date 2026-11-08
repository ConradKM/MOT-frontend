import { Outlet } from 'react-router-dom'
import { usePendingBookingRequestCount } from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { SectionTabs } from '../SectionTabs'

/** Appointments in the top menu covers two pages: the calendar, and the
 * public booking requests waiting to become appointments. The old
 * /booking-requests URL redirects to the Requests tab (see App.tsx). */
export function AppointmentsLayout() {
  const garageId = useGarageId()
  const pending = usePendingBookingRequestCount()

  return (
    <div>
      <SectionTabs
        label="Appointments sections"
        tabs={[
          { to: `/${garageId}/appointments`, label: 'Calendar', end: true },
          { to: `/${garageId}/appointments/requests`, label: 'Requests', badge: pending },
        ]}
      />
      <Outlet />
    </div>
  )
}
