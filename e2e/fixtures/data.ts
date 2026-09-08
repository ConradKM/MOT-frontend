/** API-shaped fixtures for the E2E stubs. Mirrors the backend's response
 * shapes; nothing here is a secret and no real service is contacted. */

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64url')

/** A syntactically valid JWT with a fixed placeholder signature — the frontend
 * only ever decodes `sub` from it. */
export const jwt = (sub = 'e1') =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub })}.e2esignature`

export const GARAGE = {
  id: 'g1',
  name: 'Bennett Motors',
  slug: 'bennett-motors',
  layout_variant: null,
  email: 'hello@bennett.example',
  phone: '+441234567890',
  address: '1 Long Lane',
  postcode: 'AB1 2CD',
  website: null,
  created_at: '2026-01-01T09:00:00+00:00',
  updated_at: '2026-01-01T09:00:00+00:00',
}

export const CUSTOMERS = [
  {
    id: 'c1',
    garage_id: 'g1',
    first_name: 'Oliver',
    last_name: 'Bennett',
    email: 'oliver@example.com',
    phone: '07123456789',
    is_active: true,
    sms_opt_out: false,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'c2',
    garage_id: 'g1',
    first_name: 'Nadia',
    last_name: 'Okafor',
    email: 'nadia@example.com',
    phone: '07123456780',
    is_active: true,
    sms_opt_out: false,
    created_at: '',
    updated_at: '',
  },
]

export const VEHICLES = [
  {
    id: 'v1',
    garage_id: 'g1',
    customer_id: 'c1',
    registration_number: 'OB08AUD',
    make: 'Audi',
    model: 'A4',
    year: 2018,
    current_mileage: 40000,
    mot_expiry_date: '2027-08-12',
    is_active: true,
    created_at: '',
    updated_at: '',
  },
]

export const APPOINTMENT_TYPES = [
  {
    id: 'at1',
    garage_id: 'g1',
    name: 'MOT test',
    description: 'Annual MOT',
    base_price: '54.85',
    default_duration_minutes: 60,
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  },
]

export const CAPACITY = {
  today: { booked_minutes: 120, capacity_minutes: 480, level: 'green' },
  week: { booked_minutes: 1200, capacity_minutes: 2400, level: 'amber' },
}

/** A booking window far enough ahead that no day in it is ever "past". */
const YEAR = 2099
export const BOOKING_DATE = `${YEAR}-09-14`

export const PUBLIC_GARAGE = {
  id: 'g1',
  name: 'Bennett Motors',
  slug: 'bennett-motors',
  appointment_types: [
    {
      id: 'at1',
      name: 'MOT test',
      description: 'Annual MOT',
      base_price: '54.85',
      default_duration_minutes: 60,
      included_items: [{ label: 'Brake check', description: null }],
    },
    {
      id: 'at2',
      name: 'Full service',
      description: null,
      base_price: '180.00',
      default_duration_minutes: 180,
      included_items: [],
    },
  ],
}

export const AVAILABILITY = {
  garage: { slug: 'bennett-motors', name: 'Bennett Motors' },
  rules: {
    slot_interval_minutes: 30,
    min_lead_time_hours: 1,
    max_advance_days: 60,
    booking_window_start: `${YEAR}-09-01`,
    booking_window_end: `${YEAR}-09-30`,
  },
  opening_hours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opens_at: '09:00',
    closes_at: '17:00',
    is_closed: weekday >= 5,
  })),
  days: Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const date = `${YEAR}-09-${String(day).padStart(2, '0')}`
    const weekday = new Date(`${date}T00:00:00`).getDay()
    const closed = weekday === 0 || weekday === 6
    return {
      date,
      weekday,
      is_open: !closed,
      level: closed ? 'closed' : 'available',
      open_slots: closed ? 0 : 8,
      total_slots: closed ? 0 : 8,
    }
  }),
}

export const DAY_AVAILABILITY = {
  date: BOOKING_DATE,
  is_open: true,
  level: 'available',
  slots: [
    { start: '09:00', status: 'available', remaining: 2, capacity: 2 },
    { start: '09:30', status: 'available', remaining: 2, capacity: 2 },
    { start: '10:00', status: 'booked', remaining: 0, capacity: 2 },
  ],
}
