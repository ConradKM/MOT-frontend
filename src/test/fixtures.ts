import type {
  Appointment,
  AppointmentType,
  Customer,
  Employee,
  Garage,
  GarageAppointmentStatus,
  Role,
  Vehicle,
} from '../types'
import type {
  AvailabilityRange,
  DayAvailabilityDetail,
  PublicGarage,
} from '../api/publicGarage'

/**
 * Canonical API-shaped objects for tests. Every factory takes an override
 * patch so a test states only the fields its assertion depends on — which
 * keeps the *reason* a test exists visible in the test itself.
 */

export const GARAGE_ID = 'g1'

export function makeGarage(patch: Partial<Garage> = {}): Garage {
  return {
    id: GARAGE_ID,
    name: 'Bennett Motors',
    slug: 'bennett-motors',
    layout_variant: null,
    email: 'hello@bennett.example',
    phone: '+441234567890',
    address: '1 Long Lane',
    postcode: 'AB1 2CD',
    website: null,
    logo_url: null,
    created_at: '2026-01-01T09:00:00+00:00',
    updated_at: '2026-01-01T09:00:00+00:00',
    ...patch,
  }
}

export function makeRole(patch: Partial<Role> = {}): Role {
  return {
    id: 'r1',
    garage_id: GARAGE_ID,
    name: 'OWNER',
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeEmployee(patch: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    garage_id: GARAGE_ID,
    email: 'greg@bennett.example',
    first_name: 'Greg',
    last_name: 'Mason',
    is_active: true,
    roles: [makeRole()],
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeCustomer(patch: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    garage_id: GARAGE_ID,
    first_name: 'Oliver',
    last_name: 'Bennett',
    email: 'oliver@example.com',
    phone: '07123456789',
    is_active: true,
    sms_opt_out: false,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeVehicle(patch: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    garage_id: GARAGE_ID,
    customer_id: 'c1',
    registration_number: 'OB08AUD',
    make: 'Audi',
    model: 'A4',
    year: 2018,
    current_mileage: 40_000,
    mot_expiry_date: '2027-08-12',
    is_active: true,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeAppointmentType(patch: Partial<AppointmentType> = {}): AppointmentType {
  return {
    id: 'at1',
    garage_id: GARAGE_ID,
    name: 'MOT test',
    description: 'Annual MOT',
    base_price: '54.85',
    default_duration_minutes: 60,
    status: 'ACTIVE',
    deposit_required: false,
    deposit_type: null,
    deposit_value: null,
    deposit_currency: 'GBP',
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeAppointment(patch: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    garage_id: GARAGE_ID,
    employee_id: 'e1',
    customer_id: 'c1',
    vehicle_id: 'v1',
    start_time: '2026-09-14T09:00:00+01:00',
    end_time: '2026-09-14T10:00:00+01:00',
    appointment_type_id: 'at1',
    status: 'BOOKED',
    notes: null,
    price_at_booking: '54.85',
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

export function makeGarageStatus(
  patch: Partial<GarageAppointmentStatus> = {},
): GarageAppointmentStatus {
  return {
    id: 's1',
    garage_id: GARAGE_ID,
    key: 'BOOKED',
    label: 'Booked in',
    color: 'blue',
    sort_order: 1,
    is_terminal: false,
    is_system: true,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

/**
 * A syntactically real JWT (header.payload.signature) whose payload decodes to
 * `sub`. Never a secret — the signature is a fixed placeholder and nothing in
 * the frontend verifies it.
 */
export function makeJwt(sub = 'e1', extra: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, ...extra })}.testsignature`
}

// --- public booking ---------------------------------------------------------

export function makePublicGarage(patch: Partial<PublicGarage> = {}): PublicGarage {
  return {
    id: GARAGE_ID,
    name: 'Bennett Motors',
    slug: 'bennett-motors',
    logo_url: null,
    appointment_types: [],
    ...patch,
  }
}

/** A fixed 7-day window whose dates are all in the future, so tests never
 * become "past" (and therefore unselectable) as real time moves on. */
export const AVAILABILITY_FROM = '2099-09-14'

export function makeAvailabilityRange(patch: Partial<AvailabilityRange> = {}): AvailabilityRange {
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: `2099-09-${String(14 + i).padStart(2, '0')}`,
    weekday: i,
    is_open: i < 5,
    level: (i < 5 ? 'available' : 'closed') as AvailabilityRange['days'][number]['level'],
    open_slots: i < 5 ? 8 : 0,
    total_slots: i < 5 ? 8 : 0,
  }))
  return {
    garage: { slug: 'bennett-motors', name: 'Bennett Motors' },
    rules: {
      slot_interval_minutes: 30,
      min_lead_time_hours: 1,
      max_advance_days: 60,
      booking_window_start: AVAILABILITY_FROM,
      booking_window_end: '2099-09-20',
    },
    opening_hours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      opens_at: '09:00',
      closes_at: '17:00',
      is_closed: weekday >= 5,
    })),
    days,
    ...patch,
  }
}

export function makeDayAvailability(
  date = AVAILABILITY_FROM,
  patch: Partial<DayAvailabilityDetail> = {},
): DayAvailabilityDetail {
  return {
    date,
    is_open: true,
    level: 'available',
    slots: [
      { start: '09:00', status: 'available', remaining: 2, capacity: 2 },
      { start: '09:30', status: 'limited', remaining: 1, capacity: 2 },
      { start: '10:00', status: 'booked', remaining: 0, capacity: 2 },
    ],
    ...patch,
  }
}
