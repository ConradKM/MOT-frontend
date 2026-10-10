import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { TERMS_TEXT } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { BOOKING_BASE_URL } from '../../lib/bookingUrl'
import { SECTIONS } from '../../components/settings/SettingsLayout'
import { TermsSettings } from './TermsSettings'

function renderSettings() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/terms" element={<TermsSettings />} />
    </Routes>,
    { route: '/g1/settings/terms' },
  )
}

function withSavedTerms() {
  server.use(
    http.get('*/api/garage/terms', () =>
      HttpResponse.json({
        terms_and_conditions: TERMS_TEXT,
        terms_version: 3,
        terms_updated_at: '2099-09-01T10:00:00Z',
      }),
    ),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('TermsSettings', () => {
  it('is listed in the settings sidebar under Appointments', () => {
    const appointments = SECTIONS.find((s) => s.group === 'Appointments')
    expect(appointments?.items.map((i) => i.slug)).toContain('terms')
  })

  it('loads the current terms with a character count and version', async () => {
    withSavedTerms()
    renderSettings()
    const box = await screen.findByLabelText('Terms and conditions')
    expect(box).toHaveValue(TERMS_TEXT)
    expect(
      screen.getByText('Customers must accept these before booking. Leave empty to turn this off.'),
    ).toBeInTheDocument()
    expect(screen.getByText(`${TERMS_TEXT.length} / 50,000 characters`)).toBeInTheDocument()
    expect(screen.getByText(/Version 3, in effect since/)).toBeInTheDocument()
  })

  it('saves the text and confirms with a toast', async () => {
    let sent: unknown
    server.use(
      http.put('*/api/garage/terms', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          terms_and_conditions: 'No refunds.',
          terms_version: 1,
          terms_updated_at: '2099-09-14T10:00:00Z',
        })
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    const box = await screen.findByLabelText('Terms and conditions')
    await user.type(box, 'No refunds.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Terms and conditions saved.')).toBeInTheDocument()
    expect(sent).toEqual({ terms_and_conditions: 'No refunds.' })
    // Now there are terms, the public page link is offered.
    expect(await screen.findByText(`${BOOKING_BASE_URL}/terms/g1`)).toBeInTheDocument()
  })

  it('saving empty turns terms off and hides the public link', async () => {
    withSavedTerms()
    const user = userEvent.setup()
    renderSettings()
    expect(await screen.findByText(`${BOOKING_BASE_URL}/terms/g1`)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Terms and conditions'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText(
        'Terms and conditions removed - customers no longer need to accept any.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(`${BOOKING_BASE_URL}/terms/g1`)).not.toBeInTheDocument(),
    )
  })

  it('explains a 403 for a non-owner', async () => {
    server.use(
      http.put('*/api/garage/terms', () =>
        HttpResponse.json(
          { code: 403, status: 'Forbidden', message: 'Owner role required.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.type(await screen.findByLabelText('Terms and conditions'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Only the business owner can change the terms and conditions.'),
    ).toBeInTheDocument()
  })

  it('shows a server field error, e.g. over the length cap', async () => {
    server.use(
      http.put('*/api/garage/terms', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            errors: { json: { terms_and_conditions: ['Longer than maximum length 50000.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.type(await screen.findByLabelText('Terms and conditions'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Longer than maximum length 50000.')).toBeInTheDocument()
  })

  it('copies the public terms link for the business website', async () => {
    withSavedTerms()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    // userEvent.setup() installs its own clipboard stub; replace it again.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${BOOKING_BASE_URL}/terms/g1`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    withSavedTerms()
    const { container } = renderSettings()
    await screen.findByLabelText('Terms and conditions')
    await expectNoA11yViolations(container)
  })
})
