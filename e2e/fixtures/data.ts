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
    group_id: 'grp-testing',
    order: 0,
    image_url: null,
    image_content_type: null,
    image_uploaded_at: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'at2',
    garage_id: 'g1',
    name: 'Full service',
    description: null,
    base_price: '180.00',
    default_duration_minutes: 180,
    status: 'ACTIVE',
    group_id: null,
    order: 1,
    image_url: null,
    image_content_type: null,
    image_uploaded_at: null,
    created_at: '',
    updated_at: '',
  },
]

/** One group holding one service, so the settings page shows both the grouped
 * and the ungrouped path in a single render. */
export const APPOINTMENT_TYPE_GROUPS = [
  {
    id: 'grp-testing',
    garage_id: 'g1',
    name: 'Testing & servicing',
    description: 'Annual testing and scheduled servicing.',
    order: 0,
    display_mode: null,
    image_url: null,
    image_content_type: null,
    image_uploaded_at: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'grp-repairs',
    garage_id: 'g1',
    name: 'Repairs',
    description: null,
    order: 1,
    display_mode: 'GRID',
    image_url: null,
    image_content_type: null,
    image_uploaded_at: null,
    created_at: '',
    updated_at: '',
  },
]

/** The business's default questions, as the settings builder sees them -
 * including a bound field, which is what keeps a tracked record populated. */
export const FLOW_SECTIONS = [
  {
    id: 'sec-vehicle',
    garage_id: 'g1',
    title: 'Vehicle details',
    description: 'So we know what we are working on.',
    order: 0,
    is_active: true,
    appointment_type_id: null,
    created_at: '',
    updated_at: '',
    fields: [
      {
        id: 'fld-reg',
        booking_flow_section_id: 'sec-vehicle',
        label: 'Registration number',
        help_text: null,
        placeholder: 'AB12 CDE',
        field_type: 'TEXT',
        is_required: true,
        options: [],
        order: 0,
        min_value: null,
        max_value: null,
        max_length: 20,
        binds_to: 'ITEM_REFERENCE',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'fld-mileage',
        booking_flow_section_id: 'sec-vehicle',
        label: 'Current mileage',
        help_text: null,
        placeholder: null,
        field_type: 'NUMBER',
        is_required: false,
        options: [],
        order: 1,
        min_value: 0,
        max_value: null,
        max_length: null,
        binds_to: 'ITEM_USAGE',
        created_at: '',
        updated_at: '',
      },
    ],
  },
]

export const FLOW_PRESETS = {
  presets: [
    { key: 'automotive', sections: ['Vehicle details', 'Anything else'] },
    { key: 'appointments', sections: ['About your appointment'] },
    { key: 'generic', sections: ['Anything else'] },
  ],
}

export const CAPACITY = {
  today: { booked_minutes: 120, capacity_minutes: 480, level: 'green' },
  week: { booked_minutes: 1200, capacity_minutes: 2400, level: 'amber' },
}

/** A booking window far enough ahead that no day in it is ever "past". */
const YEAR = 2099
export const BOOKING_DATE = `${YEAR}-09-14`

/** One grouped service and one ungrouped, so the booking page exercises both
 * the grouped and the "other services" paths in a single walkthrough. */
export const PUBLIC_GARAGE = {
  id: 'g1',
  name: 'Bennett Motors',
  slug: 'bennett-motors',
  logo_url: null,
  booking_display_mode: 'LIST',
  appointment_type_groups: [
    {
      id: 'grp-testing',
      name: 'Testing & servicing',
      description: null,
      order: 0,
      display_mode: 'LIST',
      image_url: null,
    },
  ],
  appointment_types: [
    {
      id: 'at1',
      name: 'MOT test',
      description: 'Annual MOT',
      base_price: '54.85',
      default_duration_minutes: 60,
      group_id: 'grp-testing',
      order: 0,
      image_url: null,
      included_items: [{ label: 'Brake check', description: null }],
    },
    {
      id: 'at2',
      name: 'Full service',
      description: null,
      base_price: '180.00',
      default_duration_minutes: 180,
      group_id: null,
      order: 1,
      image_url: null,
      included_items: [],
    },
  ],
}

/** The questions this business asks. One required field, so the e2e walk
 * covers a configured field actually blocking submission. */
export const BOOKING_FLOW = {
  appointment_type_id: null,
  sections: [
    {
      id: 'sec-vehicle',
      title: 'Vehicle details',
      description: 'So we know what we are working on.',
      fields: [
        {
          id: 'fld-reg',
          label: 'Registration number',
          help_text: null,
          placeholder: 'AB12 CDE',
          field_type: 'TEXT',
          is_required: true,
          options: [],
          min_value: null,
          max_value: null,
          max_length: 20,
        },
      ],
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

/** The staff walk-in queue - closed and empty by default (see queue.spec.ts
 * for the live journey). The Dashboard reads it for its queue row. */
export const QUEUE_DASHBOARD = {
  now: '2099-09-14T10:00:00Z',
  service_date: '2099-09-14',
  is_open: false,
  accepting_joins: false,
  refusal_reason: 'queue_closed',
  refusal_message: "The walk-in queue isn't open right now.",
  capacity: 2,
  opens_at: '2099-09-14T08:00:00Z',
  closes_at: '2099-09-14T16:00:00Z',
  no_show_timeout_minutes: 10,
  average: { effective_minutes: 60, source: 'DEFAULT', auto_minutes: null, auto_sample_size: 0 },
  new_joiner_estimated_start_at: null,
  new_joiner_fits_today: false,
  entries: [],
  appointments: [],
}
