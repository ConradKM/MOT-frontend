import { http, HttpResponse } from 'msw'
import {
  makeAvailabilityRange,
  makeDayAvailability,
  makePublicGarage,
  makeAppointment,
  makeAppointmentType,
  makeCustomer,
  makeEmployee,
  makeGarage,
  makeJwt,
  makeVehicle,
} from '../fixtures'

/**
 * Default happy-path handlers. A test that cares about a failure overrides just
 * that route with `server.use(...)`; everything else stays green so the test
 * only describes the condition it is actually about.
 */
export const handlers = [
  // --- auth -------------------------------------------------------------
  http.post('*/api/auth/login', () =>
    HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: makeJwt('e1') }),
  ),
  http.post('*/api/auth/register', () =>
    HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: makeJwt('e1') }),
  ),
  http.post('*/api/auth/refresh', () => HttpResponse.json({ access_token: makeJwt('e1') })),
  http.post('*/api/customer/auth/login/reference', () =>
    HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: makeJwt('c1') }),
  ),
  http.post('*/api/customer/auth/login/password', () =>
    HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: makeJwt('c1') }),
  ),
  http.post('*/api/customer/auth/refresh', () =>
    HttpResponse.json({ access_token: makeJwt('c1') }),
  ),
  http.post('*/api/customer/auth/set-password', () => new HttpResponse(null, { status: 204 })),

  // --- garage-scoped reads ----------------------------------------------
  http.get('*/api/garage', () => HttpResponse.json(makeGarage())),
  http.get('*/api/garage/capacity/summary', () =>
    HttpResponse.json({
      today: { booked_minutes: 120, capacity_minutes: 480, level: 'green' },
      week: { booked_minutes: 1200, capacity_minutes: 2400, level: 'amber' },
    }),
  ),
  http.get('*/api/customers/', () => HttpResponse.json([makeCustomer()])),
  http.get('*/api/vehicles/', () => HttpResponse.json([makeVehicle()])),
  http.get('*/api/employees/', () => HttpResponse.json([makeEmployee()])),
  http.get('*/api/roles/', () => HttpResponse.json([])),
  http.get('*/api/appointments/', () => HttpResponse.json([makeAppointment()])),
  http.get('*/api/appointment-types/', () => HttpResponse.json([makeAppointmentType()])),
  http.get('*/api/appointment-statuses/', () => HttpResponse.json([])),
  http.get('*/api/booking-requests/', () => HttpResponse.json([])),
  http.get('*/api/mot-reminders/', () => HttpResponse.json([])),
  http.get('*/api/communications/unread-count', () =>
    HttpResponse.json({ whatsapp_unread: 0 }),
  ),

  // --- public booking ----------------------------------------------------
  http.get('*/api/public/garages/:id', () => HttpResponse.json(makePublicGarage())),
  http.get('*/api/public/:slug', () => HttpResponse.json(makePublicGarage())),
  http.get('*/api/public/:slug/availability', () =>
    HttpResponse.json(makeAvailabilityRange()),
  ),
  http.get('*/api/public/:slug/availability/:date', ({ params }) =>
    HttpResponse.json(makeDayAvailability(String(params.date))),
  ),
  http.post('*/api/public/:slug/booking-requests', () =>
    HttpResponse.json({ id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' }, { status: 201 }),
  ),
]
