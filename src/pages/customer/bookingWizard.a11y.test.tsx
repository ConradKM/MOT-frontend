import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  AVAILABILITY_FROM,
  makeAvailabilityRange,
  makeBookingFlow,
  makeBookingFlowField,
  makeBookingFlowSection,
  makeDayAvailability,
  makePublicAppointmentType,
  makePublicGarage,
} from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import { expectNoA11yViolations } from '../../test/a11y'
import { formatLongDate } from '../../lib/datetime'

/**
 * The booking wizard is the product's only public, unauthenticated form, so
 * its accessibility is checked step by step rather than only at the end.
 *
 * The details step is now assembled from a business's own configuration, so
 * the checks below deliberately cover a configured field of each awkward kind
 * (a select, a checkbox, a multi-select) rather than only plain text inputs -
 * those are the ones a hand-rolled form usually gets wrong.
 */
const CONFIGURED_SECTION = makeBookingFlowSection({
  id: 's-about',
  title: 'About your visit',
  description: 'A few details so we can prepare.',
  fields: [
    makeBookingFlowField({
      id: 'f-first-visit',
      label: 'Have you visited us before?',
      field_type: 'SELECT',
      is_required: true,
      options: ['First visit', "I've been before"],
    }),
    makeBookingFlowField({
      id: 'f-addons',
      label: 'Add-ons',
      field_type: 'MULTI_SELECT',
      options: ['Wash', 'Wax'],
    }),
    makeBookingFlowField({
      id: 'f-consent',
      label: 'Text me a reminder',
      field_type: 'CHECKBOX',
    }),
    makeBookingFlowField({
      id: 'f-notes',
      label: 'Anything we should know?',
      field_type: 'TEXTAREA',
      help_text: 'Allergies, access requirements - anything at all.',
    }),
  ],
})

function renderWizard() {
  server.use(
    http.get('*/api/public/garages/:id', () =>
      HttpResponse.json(
        makePublicGarage({
          appointment_types: [
            makePublicAppointmentType({ id: 'at1', name: 'MOT test', description: 'Annual MOT' }),
          ],
        }),
      ),
    ),
    http.get('*/api/public/:slug/booking-flow', () =>
      HttpResponse.json(makeBookingFlow({ sections: [CONFIGURED_SECTION] })),
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

/** Service, then date & time, then the details step. */
async function reachDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Bennett Motors' })
  await user.click(await screen.findByRole('button', { name: /^MOT test/ }))
  await user.click(
    await screen.findByRole('gridcell', { name: new RegExp(formatLongDate(AVAILABILITY_FROM)) }),
  )
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
  await screen.findByRole('heading', { name: 'Your details' })
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^First name/), 'Oliver')
  await user.type(screen.getByLabelText(/^Last name/), 'Bennett')
  await user.type(screen.getByLabelText(/^Email/), 'oliver@example.com')
  await user.type(screen.getByLabelText(/^Mobile number/), '07123456789')
  await user.selectOptions(screen.getByLabelText(/^Have you visited us before\?/), 'First visit')
}

describe('BookingWizard — accessibility', () => {
  it('has no detectable violations on the service step', async () => {
    const { container } = renderWizard()
    await screen.findByRole('heading', { name: 'What would you like to book?' })
    await expectNoA11yViolations(container)
  })

  it('has no detectable violations on the date & time step', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await screen.findByRole('heading', { name: 'Bennett Motors' })
    await user.click(await screen.findByRole('button', { name: /^MOT test/ }))
    await screen.findByRole('heading', { name: 'Pick a date & time' })
    await expectNoA11yViolations(container)
  })

  it('labels every field on the details step, configured ones included', async () => {
    // Each of these must be reachable by its visible label — a customer using
    // a screen reader gets nothing but "edit text" otherwise. The configured
    // fields matter most: they are rendered generically, so a missing
    // association here would affect every business at once.
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)

    for (const label of [
      'First name',
      'Last name',
      'Email',
      'Mobile number',
      'Have you visited us before\\?',
      'Text me a reminder',
      'Anything we should know\\?',
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

  it('exposes a configured field help text as its description', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)

    expect(screen.getByLabelText(/^Anything we should know\?/)).toHaveAccessibleDescription(
      'Allergies, access requirements - anything at all.',
    )
  })

  it('associates a validation message with the configured field it belongs to', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const select = screen.getByLabelText(/^Have you visited us before\?/)
    expect(select).toHaveAccessibleDescription('Have you visited us before? is required.')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('associates a validation message with a built-in field it belongs to', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachDetailsStep(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const firstName = screen.getByLabelText(/^First name/)
    expect(firstName).toHaveAccessibleDescription('First name is required.')
    expect(firstName).toHaveAttribute('aria-invalid', 'true')
  })

  it('has no detectable violations on the review step', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await reachDetailsStep(user)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    await expectNoA11yViolations(container)
  })

  it('has no detectable violations on the confirmation screen', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard()
    await reachDetailsStep(user)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await screen.findByRole('heading', { name: 'Request received' })
    await expectNoA11yViolations(container)
  })
})
