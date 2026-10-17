import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AvailabilitySettings } from './AvailabilitySettings'

function renderPage() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/availability" element={<AvailabilitySettings />} />
    </Routes>,
    { route: '/g1/settings/availability' },
  )
}

describe('AvailabilitySettings', () => {
  it('orders the sections opening hours, slot rules, then closures', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Opening hours' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Opening hours',
      'Slot rules',
      'One-off closures',
    ])
  })

  it('shows the "limited" threshold as a percentage in plain words', async () => {
    renderPage()
    const field = await screen.findByRole('spinbutton', { name: 'Show "limited availability" when' })
    // Stored as 0.5 by the default handler.
    expect(field).toHaveValue(50)
    expect(field).toHaveAccessibleDescription('% or fewer of a time\'s places are free')
    expect(
      screen.getByRole('button', { name: 'About Show "limited availability" when' }),
    ).toHaveAccessibleDescription(/at 50% a slot that takes 4 bookings/)
  })

  it('saves the percentage as the 0-1 ratio the API expects', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.put('*/api/garage/schedule/settings', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'sch1', ...body })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    const field = await screen.findByRole('spinbutton', { name: 'Show "limited availability" when' })
    await user.clear(field)
    await user.type(field, '25')
    await user.click(screen.getByRole('button', { name: 'Save slot rules' }))

    expect(await screen.findByText('Availability rules saved.')).toBeInTheDocument()
    expect(body?.limited_threshold_ratio).toBe(0.25)
  })

  it('moves field explanations into tips', async () => {
    renderPage()
    expect(
      await screen.findByRole('button', { name: 'About Slot length (minutes)' }),
    ).toHaveAccessibleDescription(/How often a bookable start time appears/)
    expect(screen.queryByText(/How often a bookable start time appears/, { ignore: '[role=tooltip] *, [role=tooltip]' })).toBeNull()
  })
})
