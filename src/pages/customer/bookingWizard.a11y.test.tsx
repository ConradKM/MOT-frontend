import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  AVAILABILITY_FROM,
  makeAvailabilityRange,
  makeDayAvailability,
  makePublicGarage,
} from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import { expectNoA11yViolations } from '../../test/a11y'
import { formatLongDate } from '../../lib/datetime'

/**
 * The booking wizard is the product's only public, unauthenticated form, so
 * its accessibility is checked step by step rather than only at the end.
 */
function renderWizard() {
  server.use(
    http.get('*/api/public/garages/:id', () =>
      HttpResponse.json(
        makePublicGarage({
          appointment_types: [
            {
              id: 'at1',
              name: 'MOT test',
              description: 'Annual MOT',
              base_price: '54.85',
              default_duration_minutes: 60,
              included_items: [],
            },
          ],
        }),
      ),
    ),
    http.get('*/api/public/:slug/availability', () => HttpResponse.json(makeAvailabilityRange())),
    http.get('*/api/public/:slug/availability/:date', () =>
      HttpResponse.json(makeDayAvailability()),
    ),
  )
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route: '/book/g1' },
  )
}

/** Walks from the calendar to the details step. */
async function reachDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Bennett Motors' })
  await user.click(
    await screen.findByRole('gridcell', { name: new RegExp(formatLongDate(AVAILABILITY_FROM)) }),
  )
  await user.click(await screen.findByRole('button', { name: /^MOT test/ }))
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
  await screen.findByRole('heading', { name: 'Vehicle details' })
}

describe('BookingWizard — accessibility', () => {
  it('has no detectable violations on the date & time step', async () => {
    const { container } = renderWizard()
    await screen.findByRole('heading', { name: 'Pick a date & time' })
    await expectNoA11yViolations(container)
  })

  it('labels every field on the details step', async () => {
    // Each of these must be reachable by its visible label — a customer using
    // a screen reader gets nothing but "edit text" otherwise.
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)

    for (const label of [
      'Registration number',
      'Make',
      'Model',
      'Year',
      'Current mileage',
      'First name',
      'Last name',
      'Email',
      'Mobile number',
    ]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument()
    }
  })

  it('has no detectable violations on the details step', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await reachDetailsStep(user)
    await expectNoA11yViolations(container)
  })

  it('associates a validation message with the field it belongs to', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const registration = screen.getByLabelText(/^Registration number/)
    expect(registration).toHaveAccessibleDescription('Registration number is required.')
    expect(registration).toHaveAttribute('aria-invalid', 'true')
  })

  it('has no detectable violations on the review step', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await reachDetailsStep(user)

    await user.type(screen.getByLabelText(/^Registration number/), 'OB08AUD')
    await user.type(screen.getByLabelText(/^First name/), 'Oliver')
    await user.type(screen.getByLabelText(/^Last name/), 'Bennett')
    await user.type(screen.getByLabelText(/^Email/), 'oliver@example.com')
    await user.type(screen.getByLabelText(/^Mobile number/), '07123456789')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    await expectNoA11yViolations(container)
  })
})
