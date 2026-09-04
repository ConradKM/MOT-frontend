import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { CustomersList } from './CustomersList'
import * as customersApi from '../../api/customers'
import * as vehiclesApi from '../../api/vehicles'

vi.mock('../../api/customers')
vi.mock('../../api/vehicles')

const CUSTOMERS = [
  { id: 'c1', garage_id: 'g', first_name: 'Oliver', last_name: 'Bennett', email: 'oliver@example.com', phone: '+44 700 111', is_active: true, sms_opt_out: false, created_at: '', updated_at: '' },
  { id: 'c2', garage_id: 'g', first_name: 'Nadia', last_name: 'Okafor', email: 'nadia@example.com', phone: '+44 700 222', is_active: true, sms_opt_out: false, created_at: '', updated_at: '' },
]
const VEHICLES = [
  { id: 'v1', garage_id: 'g', customer_id: 'c1', registration_number: 'OB08AUD', make: 'Audi', model: 'A4', year: 2018, current_mileage: 40000, mot_expiry_date: '2026-08-12', is_active: true, created_at: '', updated_at: '' },
  { id: 'v2', garage_id: 'g', customer_id: 'c1', registration_number: 'OB11KWY', make: 'Ford', model: 'Focus', year: 2020, current_mileage: 20000, mot_expiry_date: '2027-01-01', is_active: true, created_at: '', updated_at: '' },
]

function render() {
  return renderWithProviders(
    <Routes>
      <Route path="/:garageId/customers" element={<CustomersList />} />
    </Routes>,
    { route: '/g/customers' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('CustomersList — one row per customer', () => {
  it('shows one row per customer with a vehicle count, not one row per vehicle', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    render()

    const rows = await screen.findAllByRole('row')
    // header + Oliver (2 vehicles, one row) + Nadia (no vehicles, one row)
    expect(rows).toHaveLength(1 + 2)
    expect(screen.getByText('2 vehicles')).toBeInTheDocument()
    expect(screen.getByText('No vehicles')).toBeInTheDocument()
    // Individual registrations are a detail-page concern, not the main list.
    expect(screen.queryByText('OB08AUD')).not.toBeInTheDocument()
  })

  it('shows the soonest (most urgent) MOT expiry for a multi-vehicle customer', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    render()

    const row = (await screen.findByText('Oliver Bennett')).closest('tr')!
    // OB08AUD expires 2026-08-12, before OB11KWY's 2027-01-01.
    expect(within(row).getByText('12 Aug 2026')).toBeInTheDocument()
  })

  it('searches across customer and vehicle fields, surfacing the customer row', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    const user = userEvent.setup()
    render()
    await screen.findByText('Oliver Bennett')

    const box = screen.getByPlaceholderText(/Search name, email/)
    await user.type(box, 'focus') // vehicle model, on Oliver's second car
    expect(screen.getByText('Oliver Bennett')).toBeInTheDocument()
    expect(screen.queryByText('Nadia Okafor')).not.toBeInTheDocument()

    await user.clear(box)
    await user.type(box, 'OB08AUD') // registration
    expect(screen.getByText('Oliver Bennett')).toBeInTheDocument()

    await user.clear(box)
    await user.type(box, 'nadia') // customer name
    const table = screen.getByRole('table')
    expect(within(table).getByText('Nadia Okafor')).toBeInTheDocument()
    expect(within(table).queryByText('Oliver Bennett')).not.toBeInTheDocument()
  })

  it('links the customer name to their detail page', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    render()

    const link = await screen.findByRole('link', { name: 'Oliver Bennett' })
    expect(link).toHaveAttribute('href', '/g/customers/c1')
  })
})
