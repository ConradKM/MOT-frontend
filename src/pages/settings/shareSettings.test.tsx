import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BOOKING_BASE_URL } from '../../lib/bookingUrl'
import { ShareSettings } from './ShareSettings'
import * as groupsApi from '../../api/appointmentTypeGroups'
import * as appointmentTypesApi from '../../api/appointmentTypes'
import * as termsApi from '../../api/terms'
import { makeAppointmentType, makeAppointmentTypeGroup } from '../../test/fixtures'

vi.mock('../../api/appointmentTypeGroups')
vi.mock('../../api/appointmentTypes')
vi.mock('../../api/terms')

function render() {
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/share" element={<ShareSettings />} />
    </Routes>,
    { route: '/g1/settings/share' },
  )
}

function withTerms(text: string | null) {
  vi.mocked(termsApi.getGarageTerms).mockResolvedValue({
    terms_and_conditions: text,
    terms_version: text ? 1 : null,
    terms_updated_at: text ? '2026-01-01T00:00:00Z' : null,
  })
}

beforeEach(() => {
  vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([])
  vi.mocked(appointmentTypesApi.listAppointmentTypes).mockResolvedValue([makeAppointmentType()])
  withTerms(null)
})

afterEach(() => vi.clearAllMocks())

describe('Share your business', () => {
  it('shows the public booking link with its QR code', async () => {
    render()
    expect(await screen.findByRole('heading', { name: 'Public booking link' })).toBeInTheDocument()
    expect(screen.getAllByText(`${BOOKING_BASE_URL}/book/g1`).length).toBeGreaterThan(0)
    const qr = screen.getByLabelText('Booking link QR code')
    await waitFor(() => expect(qr.querySelector('svg')).not.toBeNull())
  })

  it('gives a link per service and per group', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    render()
    expect(await screen.findByText(/\?service=at1$/)).toBeInTheDocument()
    expect(screen.getByText(/\?group=grp1$/)).toBeInTheDocument()
  })

  it('says a one-service group skips straight to the calendar', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    vi.mocked(appointmentTypesApi.listAppointmentTypes).mockResolvedValue([
      makeAppointmentType({ id: 'at1', group_id: 'grp1' }),
    ])
    render()
    expect(await screen.findByText(/Only one service in this group/)).toBeInTheDocument()
  })

  it('also collects the walk-in queue link', async () => {
    render()
    expect(await screen.findByRole('heading', { name: 'Walk-in queue link' })).toBeInTheDocument()
    expect(screen.getByText(`${BOOKING_BASE_URL}/queue/g1`)).toBeInTheDocument()
  })

  it('shows the public terms page only once there are terms', async () => {
    render()
    await screen.findByRole('heading', { name: 'Walk-in queue link' })
    expect(screen.queryByRole('heading', { name: 'Public terms page' })).not.toBeInTheDocument()
  })

  it('shows the public terms page when terms exist', async () => {
    withTerms('Deposits are non-refundable.')
    render()
    expect(await screen.findByRole('heading', { name: 'Public terms page' })).toBeInTheDocument()
  })
})
