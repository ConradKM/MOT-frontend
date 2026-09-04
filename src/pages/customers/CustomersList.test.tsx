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
  { id: 'c1', garage_id: 'g', first_name: 'Oliver', last_name: 'Bennett', email: 'oliver@example.com', phone: '+44 700 111', created_at: '', updated_at: '' },
  { id: 'c2', garage_id: 'g', first_name: 'Nadia', last_name: 'Okafor', email: 'nadia@example.com', phone: '+44 700 222', created_at: '', updated_at: '' },
]
const VEHICLES = [
  { id: 'v1', garage_id: 'g', customer_id: 'c1', registration_number: 'OB08AUD', make: 'Audi', model: 'A4', year: 2018, current_mileage: 40000, mot_expiry_date: '2026-08-12', created_at: '', updated_at: '' },
  { id: 'v2', garage_id: 'g', customer_id: 'c1', registration_number: 'OB11KWY', make: 'Ford', model: 'Focus', year: 2020, current_mileage: 20000, mot_expiry_date: '2027-01-01', created_at: '', updated_at: '' },
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

describe('CustomersList — merged customers + vehicles', () => {
  it('shows one row per vehicle and a "no vehicle" row for customers with none', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    render()

    const rows = await screen.findAllByRole('row')
    // header + 2 rows for Oliver (Audi, Ford) + 1 "no vehicle" row for Nadia
    expect(rows).toHaveLength(1 + 3)
    expect(screen.getByRole('link', { name: 'OB08AUD' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'OB11KWY' })).toBeInTheDocument()
    expect(screen.getByText('No vehicle')).toBeInTheDocument()
  })

  it('searches across customer and vehicle fields', async () => {
    vi.mocked(customersApi.listCustomers).mockResolvedValue(CUSTOMERS)
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue(VEHICLES)
    const user = userEvent.setup()
    render()
    await screen.findByRole('link', { name: 'OB08AUD' })

    const box = screen.getByPlaceholderText(/Search name, email/)
    await user.type(box, 'focus') // vehicle model
    expect(screen.getByRole('link', { name: 'OB11KWY' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'OB08AUD' })).not.toBeInTheDocument()

    await user.clear(box)
    await user.type(box, 'nadia') // customer name
    const table = screen.getByRole('table')
    expect(within(table).getByText('Nadia Okafor')).toBeInTheDocument()
    expect(within(table).queryByText('Oliver Bennett')).not.toBeInTheDocument()
  })
})
