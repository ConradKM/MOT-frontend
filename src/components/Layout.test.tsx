import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { makeGarage } from '../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../test/utils'
import { Layout } from './Layout'
import { getAccessToken } from '../api/tokens'

function renderLayout(route = '/g1/customers') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId" element={<Layout />}>
        <Route path="customers" element={<h1>Customers page</h1>} />
        <Route path="dashboard" element={<h1>Dashboard page</h1>} />
      </Route>
      <Route path="/login" element={<h1>Login page</h1>} />
    </Routes>,
    { route },
  )
}

describe('Layout — garage chrome', () => {
  it('renders the signed-in garage’s own name, not the platform’s', async () => {
    // The tenant's identity is primary everywhere in the staff app.
    server.use(http.get('*/api/garage', () => HttpResponse.json(makeGarage({ name: 'Vale Autos' }))))
    signInAsStaff()
    renderLayout()
    expect(await screen.findByText('Vale Autos')).toBeInTheDocument()
  })

  it('falls back to the platform name while the garage is still loading', () => {
    signInAsStaff()
    renderLayout()
    expect(screen.getByText('CoMaz OS')).toBeInTheDocument()
  })

  it('renders the outlet’s page beneath the chrome', async () => {
    signInAsStaff()
    renderLayout()
    expect(await screen.findByRole('heading', { name: 'Customers page' })).toBeInTheDocument()
  })

  it('links every primary section under the current garage id', async () => {
    signInAsStaff()
    renderLayout()
    await screen.findByText('Bennett Motors')

    for (const [label, path] of [
      ['Dashboard', '/g1/dashboard'],
      ['Customers', '/g1/customers'],
      ['Appointments', '/g1/appointments'],
      ['Requests', '/g1/booking-requests'],
      ['Settings', '/g1/settings'],
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute(
        'href',
        path,
      )
    }
  })

  it('marks the section the user is currently in as the active page', async () => {
    signInAsStaff()
    renderLayout()
    const current = await screen.findByRole('link', { name: 'Customers' })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })
})

describe('Layout — unread communications badge', () => {
  it('shows the unread WhatsApp count on the Communications link', async () => {
    server.use(
      http.get('*/api/communications/unread-count', () =>
        HttpResponse.json({ whatsapp_unread: 3 }),
      ),
    )
    signInAsStaff()
    renderLayout()
    expect(await screen.findByRole('link', { name: 'Communications 3' })).toBeInTheDocument()
  })

  it('shows no badge when there is nothing unread', async () => {
    signInAsStaff()
    renderLayout()
    await screen.findByText('Bennett Motors')
    expect(screen.getByRole('link', { name: 'Communications' })).toBeInTheDocument()
  })

  it('shows no badge when the count cannot be fetched', async () => {
    // A failing side-panel query must not take the whole navigation down.
    server.use(
      http.get('*/api/communications/unread-count', () =>
        HttpResponse.json({ code: 500, status: 'x' }, { status: 500 }),
      ),
    )
    signInAsStaff()
    renderLayout()
    expect(await screen.findByRole('link', { name: 'Communications' })).toBeInTheDocument()
  })
})

describe('Layout — stale garage id in the URL', () => {
  it('rewrites the URL to the garage the signed-in employee actually belongs to', async () => {
    // A bookmarked or hand-edited link must not show another tenant's chrome.
    signInAsStaff()
    renderLayout('/other-garage/customers')
    // The redirect only fires once the garage query resolves and reveals the
    // mismatch, so this waits rather than asserting on the first paint.
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute(
        'href',
        '/g1/customers',
      ),
    )
    // Same page, corrected id — the user is not bounced to the dashboard.
    expect(screen.getByRole('heading', { name: 'Customers page' })).toBeInTheDocument()
  })
})

describe('Layout — logout', () => {
  it('clears the session when the user logs out', async () => {
    signInAsStaff()
    const user = userEvent.setup()
    renderLayout()
    await screen.findByText('Bennett Motors')

    await user.click(screen.getByRole('button', { name: /log out/i }))
    await waitFor(() => expect(getAccessToken()).toBeNull())
  })
})
