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
  makePublicQueueInfo,
  makeQueueDashboard,
  makeQueueEntry,
  makeQueueSettings,
  makeQueueStatus,
  makeVehicle,
  QUEUE_TOKEN,
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
  http.get('*/api/appointment-type-groups/', () => HttpResponse.json([])),
  http.get('*/api/booking-flow/sections', () => HttpResponse.json([])),
  http.get('*/api/booking-flow/presets', () => HttpResponse.json({ presets: [] })),
  http.get('*/api/booking-requests/', () => HttpResponse.json([])),
  http.get('*/api/mot-reminders/', () => HttpResponse.json([])),
  http.get('*/api/mot-reminders/settings', () =>
    HttpResponse.json({
      id: 's1',
      stage1_enabled: true,
      stage1_days_before: 30,
      stage2_enabled: true,
      stage2_days_before: 7,
      stage3_enabled: true,
      stage3_days_before: 1,
    }),
  ),
  http.get('*/api/garage/schedule', () =>
    HttpResponse.json({
      settings: {
        id: 'sch1',
        slot_interval_minutes: 30,
        default_appointment_minutes: 60,
        min_lead_time_hours: 2,
        max_advance_days: 60,
        capacity_per_slot: null,
        limited_threshold_ratio: 0.5,
      },
      opening_hours: [],
      exceptions: [],
    }),
  ),
  http.get('*/api/communications/automation-settings', () =>
    HttpResponse.json({
      booking_ack_enabled: true,
      booking_confirmation_enabled: true,
      reminder_enabled: true,
      reminder_hours_before: 24,
      missed_call_ack_enabled: false,
      conversation_automation_enabled: false,
    }),
  ),
  http.get('*/api/communications/templates', () => HttpResponse.json({ items: [] })),
  http.get('*/api/communications/unread-count', () =>
    HttpResponse.json({ whatsapp_unread: 0 }),
  ),

  // --- public booking ----------------------------------------------------
  http.get('*/api/public/garages/:id', () => HttpResponse.json(makePublicGarage())),
  http.get('*/api/public/:slug', () => HttpResponse.json(makePublicGarage())),
  http.get('*/api/public/:slug/booking-flow', () =>
    HttpResponse.json({ appointment_type_id: null, sections: [] }),
  ),
  http.get('*/api/public/:slug/availability', () =>
    HttpResponse.json(makeAvailabilityRange()),
  ),
  http.get('*/api/public/:slug/availability/:date', ({ params }) =>
    HttpResponse.json(makeDayAvailability(String(params.date))),
  ),
  http.post('*/api/public/:slug/booking-requests', () =>
    HttpResponse.json({ id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' }, { status: 201 }),
  ),

  // --- walk-in queue -------------------------------------------------------
  http.get('*/api/public/:slug/queue', () => HttpResponse.json(makePublicQueueInfo())),
  http.post('*/api/public/:slug/queue/join', () =>
    HttpResponse.json(
      { ...makeQueueStatus({ position: 3, people_ahead: 2 }), token: QUEUE_TOKEN },
      { status: 201 },
    ),
  ),
  http.post('*/api/public/:slug/queue/status', () => HttpResponse.json(makeQueueStatus())),
  http.post('*/api/public/:slug/queue/cancel', () =>
    HttpResponse.json(
      makeQueueStatus({ status: 'CANCELLED', end_reason: 'CUSTOMER_CANCELLED', position: null }),
    ),
  ),
  http.get('*/api/queue', () => HttpResponse.json(makeQueueDashboard())),
  http.post('*/api/queue/call-next', () => HttpResponse.json(makeQueueEntry({ status: 'CALLED' }))),
  http.post('*/api/queue/entries/:id/:action', () => HttpResponse.json(makeQueueEntry())),
  http.get('*/api/queue/settings', () => HttpResponse.json(makeQueueSettings())),
  http.get('*/api/queue/reserved-windows', () => HttpResponse.json([])),
]
