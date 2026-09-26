import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeLoyaltyProgram } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { LoyaltySettings } from './LoyaltySettings'

function renderSettings() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/loyalty" element={<LoyaltySettings />} />
    </Routes>,
    { route: '/g1/settings/loyalty' },
  )
}

describe('LoyaltySettings', () => {
  it('loads the current programme into the form', async () => {
    server.use(
      http.get('*/api/loyalty/program', () =>
        HttpResponse.json(
          makeLoyaltyProgram({ enabled: true, name: 'Regulars Club', threshold: 8, reward_value_minor: 500 }),
        ),
      ),
    )
    renderSettings()
    expect(await screen.findByDisplayValue('Regulars Club')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5.00')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Loyalty enabled' })).toBeChecked()
  })

  it('saves updated settings', async () => {
    let sent: unknown
    server.use(
      http.patch('*/api/loyalty/program', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeLoyaltyProgram({ enabled: true, name: 'Regulars Club' }))
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('checkbox', { name: 'Loyalty enabled' }))
    const nameInput = screen.getByLabelText('Programme name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Regulars Club')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(sent).toMatchObject({
        enabled: true,
        name: 'Regulars Club',
        threshold: 5,
        reward_value_minor: 1000,
        qualifying_appointment_type_ids: null,
      }),
    )
    expect(await screen.findByText('Loyalty settings saved.')).toBeInTheDocument()
  })

  it('rejects a threshold below 1', async () => {
    const user = userEvent.setup()
    renderSettings()
    const threshold = await screen.findByDisplayValue('5')
    await user.clear(threshold)
    await user.type(threshold, '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Visits required must be at least 1.')).toBeInTheDocument()
  })

  it('shows the owner-only message on a 403', async () => {
    server.use(
      http.patch('*/api/loyalty/program', () =>
        HttpResponse.json({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Only the business owner can change loyalty settings.'),
    ).toBeInTheDocument()
  })
})
