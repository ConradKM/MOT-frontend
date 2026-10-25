import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { renderWithAppProviders } from '../test/utils'
import { expectNoA11yViolations } from '../test/a11y'
import { UnsubscribePage } from './UnsubscribePage'

function renderPage(route = '/unsubscribe?token=signed-token') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
    </Routes>,
    { route },
  )
}

describe('UnsubscribePage', () => {
  it('asks before opting out, and only the button changes anything', async () => {
    const posted: unknown[] = []
    server.use(
      http.post('*/api/public/marketing/unsubscribe/preview', () =>
        HttpResponse.json({ business_name: 'Bennett Motors', unsubscribed: false }),
      ),
      http.post('*/api/public/marketing/unsubscribe', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ business_name: 'Bennett Motors', unsubscribed: true })
      }),
    )
    const user = userEvent.setup()
    const { container } = renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Stop offers from Bennett Motors?' }),
    ).toBeInTheDocument()
    expect(posted).toHaveLength(0)
    await expectNoA11yViolations(container)

    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }))
    expect(await screen.findByRole('heading', { name: "You're unsubscribed" })).toBeInTheDocument()
    expect(posted).toEqual([{ token: 'signed-token' }])
    expect(screen.getByText(/still get booking confirmations/)).toBeInTheDocument()
  })

  it('says when a customer is already unsubscribed', async () => {
    server.use(
      http.post('*/api/public/marketing/unsubscribe/preview', () =>
        HttpResponse.json({ business_name: 'Bennett Motors', unsubscribed: true }),
      ),
    )
    renderPage()
    expect(await screen.findByRole('heading', { name: "You're unsubscribed" })).toBeInTheDocument()
  })

  it('explains a bad or missing link', async () => {
    server.use(
      http.post('*/api/public/marketing/unsubscribe/preview', () =>
        HttpResponse.json({ code: 404, message: "This unsubscribe link isn't valid." }, { status: 404 }),
      ),
    )
    renderPage()
    expect(await screen.findByRole('heading', { name: "This link isn't valid" })).toBeInTheDocument()
  })

  it('explains a link with no token', async () => {
    renderPage('/unsubscribe')
    expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument()
  })
})
