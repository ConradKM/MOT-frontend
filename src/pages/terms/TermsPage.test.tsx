import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { GARAGE_ID, makePublicTerms } from '../../test/fixtures'
import { renderWithProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { TermsPage } from './TermsPage'

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/terms/:garageId" element={<TermsPage />} />
      <Route path="/terms/:garageId/v/:version" element={<TermsPage />} />
    </Routes>,
    { route },
  )
}

const notFound = () =>
  HttpResponse.json({ code: 404, status: 'Not Found', message: 'none' }, { status: 404 })

describe('TermsPage', () => {
  it('shows the current terms as plain text, with the business and version', async () => {
    server.use(
      http.get('*/api/public/garages/:id/terms', () =>
        HttpResponse.json(makePublicTerms({ body: 'One.\n<script>x</script>', version: 2 })),
      ),
    )
    const { container } = renderPage(`/terms/${GARAGE_ID}`)

    expect(await screen.findByRole('heading', { name: 'Terms and conditions' })).toBeInTheDocument()
    expect(screen.getByText('Bennett Motors')).toBeInTheDocument()
    expect(screen.getByText(/Version 2 · effective .*September 2099/)).toBeInTheDocument()
    const body = screen.getByText(/One\./)
    expect(body.textContent).toBe('One.\n<script>x</script>')
    expect(body).toHaveClass('whitespace-pre-wrap')
    expect(container.querySelector('script')).toBeNull()
    expect(screen.queryByText(/earlier version/)).not.toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('shows one exact version, saying when it has since been updated', async () => {
    let requested: string | undefined
    server.use(
      http.get('*/api/public/garages/:id/terms/:version', ({ params }) => {
        requested = String(params.version)
        return HttpResponse.json(makePublicTerms({ version: 1, body: 'Old wording', is_current: false }))
      }),
    )
    renderPage(`/terms/${GARAGE_ID}/v/1`)

    expect(await screen.findByText('Old wording')).toBeInTheDocument()
    expect(requested).toBe('1')
    expect(screen.getByRole('link', { name: 'View the current terms' })).toHaveAttribute(
      'href',
      `/terms/${GARAGE_ID}`,
    )
  })

  it('has a friendly state when the business has no terms', async () => {
    server.use(http.get('*/api/public/garages/:id/terms', notFound))
    renderPage(`/terms/${GARAGE_ID}`)
    expect(await screen.findByRole('heading', { name: 'Terms not found' })).toBeInTheDocument()
    expect(screen.getByText(/hasn't published any terms/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to their booking page' })).toHaveAttribute(
      'href',
      `/book/${GARAGE_ID}`,
    )
  })

  it('has a friendly state for an unknown version', async () => {
    server.use(http.get('*/api/public/garages/:id/terms/:version', notFound))
    renderPage(`/terms/${GARAGE_ID}/v/9`)
    expect(await screen.findByText(/couldn't find that version/)).toBeInTheDocument()
  })
})
