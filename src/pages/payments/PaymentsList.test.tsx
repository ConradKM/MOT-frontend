import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { server } from '../../test/msw/server'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { PaymentsList } from './PaymentsList'

const paymentRequest = {
  id: 'request-1',
  garage_id: 'g1',
  status: 'PENDING',
  customer_first_name: 'Oliver', customer_last_name: 'Bennett', customer_full_name: 'Oliver Bennett',
  customer_email: 'oliver@example.com', customer_phone: null,
  vehicle_registration: null, vehicle_make: null, vehicle_model: null, vehicle_year: null, vehicle_mileage: null,
  appointment_type_id: 'type-1', appointment_type: { id: 'type-1', name: 'MOT test', base_price: '54.85', description: null, default_duration_minutes: 60, status: 'ACTIVE' },
  duration_minutes: 60, requested_duration_minutes: 60, requested_price: '54.85', preferred_date: '2026-10-01', preferred_time: null,
  preferred_employee_note: null, notes: null, answers: [], answers_collected: true, is_expired: false,
  slot_check: { checked: false, available: null, reason: null }, reviewed_by_employee_id: null, reviewed_by_name: null, reviewed_at: null,
  staff_notes: null, customer_rejection_reason: null, notification_result: null, customer_id: null, vehicle_id: null, appointment_id: null,
  payment: { id: 'payment-1', status: 'SUCCEEDED', currency: 'GBP', amount: '10.00', provider: 'stripe', provider_payment_id: 'pi_secret', refunded_amount_minor: null, refunded_at: null, paid_at: '2026-09-16T09:00:00+01:00', failure_reason: null },
  created_at: '2026-09-16T08:00:00+01:00', updated_at: '2026-09-16T09:00:00+01:00',
}

function renderPage() {
  signInAsStaff()
  return renderWithAppProviders(<Routes><Route path="/:garageId/payments" element={<PaymentsList />} /></Routes>, { route: '/g1/payments' })
}

describe('PaymentsList', () => {
  it('shows the tenant payment record and its authoritative paid status', async () => {
    server.use(http.get('*/api/booking-requests/', () => HttpResponse.json([paymentRequest])))
    renderPage()
    expect(await screen.findByText('Oliver Bennett')).toBeInTheDocument()
    expect(screen.getByText('£10.00')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText(/Paid 16 Sep 2026/)).toBeInTheDocument()
    expect(screen.queryByText('pi_secret')).not.toBeInTheDocument()
  })

  it('explains when no deposit has been collected', async () => {
    server.use(http.get('*/api/booking-requests/', () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText('No deposit payments yet.')).toBeInTheDocument()
  })
})
