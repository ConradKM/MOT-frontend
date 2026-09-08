import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { GarageDetails } from './GarageDetails'
import * as garageApi from '../../api/garage'
import { ApiError } from '../../api/client'

vi.mock('../../api/garage')

const GARAGE = {
  id: 'g',
  name: 'Kingsway MOT & Service Centre',
  slug: 'kingsway-mot-service-centre-h4k2qp',
  layout_variant: null,
  email: 'hello@kingswaymot.co.uk',
  phone: '+44 20 7946 1234',
  address: '12 Kingsway, London',
  postcode: 'WC2B 6NH',
  website: null,
  created_at: '',
  updated_at: '',
}

function render() {
  vi.mocked(garageApi.getGarage).mockResolvedValue({ ...GARAGE })
  return renderWithProviders(
    <Routes>
      <Route path="/:garageId/settings/garage-details" element={<GarageDetails />} />
    </Routes>,
    { route: '/g/settings/garage-details' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('GarageDetails', () => {
  it('shows the current details in editable fields', async () => {
    render()

    expect(await screen.findByLabelText(/Business \/ trading name/)).toHaveValue(
      'Kingsway MOT & Service Centre',
    )
    expect(screen.getByLabelText('Telephone number')).toHaveValue('+44 20 7946 1234')
    expect(screen.getByLabelText('Postcode')).toHaveValue('WC2B 6NH')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('sends only the changed fields and confirms the save', async () => {
    vi.mocked(garageApi.updateGarage).mockResolvedValue({ ...GARAGE, phone: '+44 20 0000 0000' })
    const user = userEvent.setup()
    render()

    const phone = await screen.findByLabelText('Telephone number')
    await user.clear(phone)
    await user.type(phone, '+44 20 0000 0000')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(garageApi.updateGarage).toHaveBeenCalled())
    expect(vi.mocked(garageApi.updateGarage).mock.calls[0][0]).toEqual({
      phone: '+44 20 0000 0000',
    })
    expect(await screen.findByText('Business details saved.')).toBeInTheDocument()
  })

  it('surfaces a 403 as an owner-only message', async () => {
    vi.mocked(garageApi.updateGarage).mockRejectedValue(
      new ApiError({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, 'x'),
    )
    const user = userEvent.setup()
    render()

    const name = await screen.findByLabelText(/Business \/ trading name/)
    await user.clear(name)
    await user.type(name, 'New Name Ltd')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Only the business owner can change these details.'),
    ).toBeInTheDocument()
  })

  it('notes that the slug and system settings are platform-managed', async () => {
    render()
    expect(
      await screen.findByText(/managed by the platform administrator/i),
    ).toBeInTheDocument()
  })

  it('shows the public booking link and a QR code with PNG/SVG download', async () => {
    render()

    expect(
      await screen.findByText('https://app.comaz.co.uk/book/g'),
    ).toBeInTheDocument()

    const qr = await screen.findByLabelText('Booking link QR code')
    await waitFor(() => expect(qr.querySelector('svg')).not.toBeNull())

    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeEnabled()
  })
})
