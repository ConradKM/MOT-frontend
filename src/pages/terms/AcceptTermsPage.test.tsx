import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { GARAGE_ID, TERMS_TOKEN, makeTermsAcceptanceLookup } from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { AcceptTermsPage } from './AcceptTermsPage'

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(hash = `#${TERMS_TOKEN}`) {
  return renderWithAppProviders(
    <>
      <Routes>
        <Route path="/accept-terms/:garageId" element={<AcceptTermsPage />} />
        <Route path="/book/:garageId" element={<h1>Booking page</h1>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: `/accept-terms/${GARAGE_ID}${hash}` },
  )
}

function serveLookup(patch: Parameters<typeof makeTermsAcceptanceLookup>[0]) {
  server.use(
    http.post('*/api/public/:slug/terms-acceptance/lookup', () =>
      HttpResponse.json(makeTermsAcceptanceLookup(patch)),
    ),
  )
}

const box = () => screen.getByRole('checkbox', { name: /I have read and accept the/ })

describe('AcceptTermsPage', () => {
  it('shows the held booking and the terms, posting the token in the body only', async () => {
    let lookupBody: unknown
    server.use(
      http.post('*/api/public/:slug/terms-acceptance/lookup', async ({ request }) => {
        lookupBody = await request.json()
        expect(request.url).not.toContain(TERMS_TOKEN)
        return HttpResponse.json(makeTermsAcceptanceLookup())
      }),
    )
    const { container } = renderPage()

    expect(await screen.findByText(/your slot is being held/)).toBeInTheDocument()
    expect(screen.getByText('MOT test')).toBeInTheDocument()
    expect(screen.getByText('BK7F3K9Q2')).toBeInTheDocument()
    expect(box()).not.toBeChecked()
    expect(lookupBody).toEqual({ token: TERMS_TOKEN })
    await expectNoA11yViolations(container)
  })

  it('needs the box ticked, then confirms the booking request', async () => {
    let acceptBody: unknown
    server.use(
      http.post('*/api/public/:slug/terms-acceptance/accept', async ({ request }) => {
        acceptBody = await request.json()
        return HttpResponse.json({
          status: 'PENDING',
          booking_reference: 'BK7F3K9Q2',
          recovery_token: null,
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    const confirm = await screen.findByRole('button', { name: 'Confirm booking' })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    await user.click(confirm)
    expect(
      await screen.findByText('Please accept the terms and conditions to continue.'),
    ).toBeInTheDocument()
    expect(acceptBody).toBeUndefined()

    await user.click(box())
    await user.click(confirm)
    expect(await screen.findByRole('heading', { name: 'Booking request sent' })).toBeInTheDocument()
    expect(screen.getByText(/Your reference is BK7F3K9Q2/)).toBeInTheDocument()
    expect(acceptBody).toEqual({ token: TERMS_TOKEN, terms_accepted: true, terms_version: 1 })
  })

  it('continues a deposit booking straight into the existing checkout', async () => {
    serveLookup({
      booking: { ...makeTermsAcceptanceLookup().booking, deposit_required: true },
    })
    server.use(
      http.post('*/api/public/:slug/terms-acceptance/accept', () =>
        HttpResponse.json({
          status: 'AWAITING_PAYMENT',
          booking_reference: 'BK7F3K9Q2',
          recovery_token: 'recover-me',
        }),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/pay it securely on the next page/)).toBeInTheDocument()
    await user.click(box())
    await user.click(screen.getByRole('button', { name: 'Confirm and continue to payment' }))

    expect(await screen.findByRole('heading', { name: 'Booking page' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/book/${GARAGE_ID}?resume=recover-me`,
    )
  })

  it('re-prompts when the terms were edited while the page was open', async () => {
    server.use(
      http.post('*/api/public/:slug/terms-acceptance/accept', () =>
        HttpResponse.json(
          { code: 409, status: 'Conflict', errors: { reason: 'terms_version_mismatch' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: /I have read and accept the/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(
      await screen.findByText('The terms were updated. Please read and accept the latest version.'),
    ).toBeInTheDocument()
    expect(box()).not.toBeChecked()
  })

  it('explains an already-used link', async () => {
    serveLookup({ state: 'ACCEPTED', terms_and_conditions: null })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Already accepted' })).toBeInTheDocument()
  })

  it('explains an expired hold', async () => {
    serveLookup({ state: 'EXPIRED', terms_and_conditions: null })
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'This booking has expired' }),
    ).toBeInTheDocument()
  })

  it('explains a booking that can no longer be confirmed', async () => {
    serveLookup({ state: 'CLOSED', terms_and_conditions: null })
    renderPage()
    expect(
      await screen.findByRole('heading', { name: "This booking can't be confirmed here" }),
    ).toBeInTheDocument()
  })

  it('reveals nothing for an invalid token', async () => {
    server.use(
      http.post('*/api/public/:slug/terms-acceptance/lookup', () =>
        HttpResponse.json({ code: 404, status: 'Not Found' }, { status: 404 }),
      ),
    )
    renderPage()
    expect(
      await screen.findByRole('heading', { name: "We couldn't find that booking" }),
    ).toBeInTheDocument()
  })

  it('asks for the full link when the token is missing', async () => {
    renderPage('')
    expect(
      await screen.findByRole('heading', { name: 'This link is incomplete' }),
    ).toBeInTheDocument()
  })
})
