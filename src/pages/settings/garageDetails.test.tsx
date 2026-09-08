import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { GarageDetails } from './GarageDetails'
import * as garageApi from '../../api/garage'

vi.mock('../../api/garage')

function render() {
  vi.mocked(garageApi.getGarage).mockResolvedValue({
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
  })
  return renderWithProviders(
    <Routes>
      <Route path="/:garageId/settings/garage-details" element={<GarageDetails />} />
    </Routes>,
    { route: '/g/settings/garage-details' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('GarageDetails', () => {
  it('shows the business details read-only (no form fields)', async () => {
    render()

    expect(await screen.findByText('+44 20 7946 1234')).toBeInTheDocument()
    expect(screen.getByText('hello@kingswaymot.co.uk')).toBeInTheDocument()
    expect(screen.getByText('WC2B 6NH')).toBeInTheDocument()
    // Website not set -> shown as "Not set", never as an input.
    expect(screen.getByText('Not set')).toBeInTheDocument()

    // The details themselves are still read-only - no inputs.
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('tells the user to contact the platform administrator', async () => {
    render()
    expect(
      await screen.findByText(/contact the platform administrator/i),
    ).toBeInTheDocument()
  })

  it('shows the public booking link and a QR code with PNG/SVG download', async () => {
    render()

    // The UUID-based booking URL, not the slug.
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
