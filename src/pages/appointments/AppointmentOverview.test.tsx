import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeAppointment, makeCustomer, makeVehicle } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentOverview } from './AppointmentOverview'

function renderOverview(appointment = makeAppointment({ id: 'a1' })) {
  server.use(
    http.get('*/api/appointments/', () => HttpResponse.json([appointment])),
    http.get('*/api/customers/:id', () => HttpResponse.json(makeCustomer())),
    http.get('*/api/vehicles/:id', () => HttpResponse.json(makeVehicle())),
    http.get('*/api/appointments/:id/checklist', () => HttpResponse.json(null, { status: 404 })),
  )
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/appointments/:appointmentId/overview" element={<AppointmentOverview />} />
    </Routes>,
    { route: '/g1/appointments/a1/overview' },
  )
}

describe('AppointmentOverview — price', () => {
  it('shows the discount the booking was given, frozen with it', async () => {
    renderOverview(
      makeAppointment({
        id: 'a1',
        price_at_booking: '90.00',
        price_before_discount: '100.00',
        discount_code: 'LOYAL-7KQ2M9XA',
        discount_amount: '10.00',
      }),
    )
    expect(await screen.findByText('LOYAL-7KQ2M9XA')).toBeInTheDocument()
    expect(screen.getByText(/−£\s*10\.00/)).toBeInTheDocument()
    expect(screen.getByText('£100.00')).toBeInTheDocument()
  })

  it('shows a plain price when no code was used', async () => {
    renderOverview(makeAppointment({ id: 'a1', price_at_booking: '54.85' }))
    expect(await screen.findByText(/£54\.85/)).toBeInTheDocument()
    expect(screen.queryByText(/Discount/)).not.toBeInTheDocument()
  })
})
