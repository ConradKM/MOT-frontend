import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { renderWithAppProviders, signInAsStaff } from '../test/utils'
import { makeGarage } from '../test/fixtures'
import { Layout } from './Layout'
import { getAccessToken } from '../api/tokens'
import { expectNoA11yViolations } from '../test/a11y'

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
  it('shows the business’s own identity in the header, not the CoMaz logo', async () => {
    signInAsStaff()
    renderLayout()
    // Bennett Motors (the default garage fixture) has no logo, so this is
    // the initials fallback next to the business name - not a broken image,
    // and not the platform's own mark, which belongs only on the sign-in
    // screen and the Footer's subtle "Powered by CoMaz OS™".
    expect(await screen.findByText('Bennett Motors')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'CoMaz OS' })).not.toBeInTheDocument()
  })

  it('shows the persisted business logo in the header when one exists', async () => {
    server.use(
      http.get('*/api/garage', () =>
        HttpResponse.json(makeGarage({ logo_url: 'https://storage.example/logo.png' })),
      ),
    )
    signInAsStaff()
    renderLayout()

    const img = await screen.findByRole('img', { name: 'Bennett Motors logo' })
    expect(img).toHaveAttribute('src', 'https://storage.example/logo.png')
  })

  it('renders the outlet’s page beneath the chrome', async () => {
    signInAsStaff()
    renderLayout()
    expect(await screen.findByRole('heading', { name: 'Customers page' })).toBeInTheDocument()
  })

  it('links every primary section under the current garage id', async () => {
    signInAsStaff()
    renderLayout()
    await screen.findByRole('link', { name: 'Dashboard' })

    for (const [label, path] of [
      ['Dashboard', '/g1/dashboard'],
      ['Customers', '/g1/customers'],
      ['Appointments', '/g1/appointments'],
      ['Requests', '/g1/booking-requests'],
      ['Queue', '/g1/queue'],
      ['Payments', '/g1/payments'],
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
    await screen.findByRole('link', { name: 'Dashboard' })
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
    await screen.findByRole('link', { name: 'Dashboard' })

    await user.click(screen.getByRole('button', { name: /log out/i }))
    await waitFor(() => expect(getAccessToken()).toBeNull())
  })
})

describe('Layout — phone menu', () => {
  // jsdom applies no CSS, so both the inline nav and the menu button are in
  // the DOM here; which one is visible at which width is pinned in
  // e2e/responsive.spec.ts. These tests cover the panel's behaviour.
  async function openMenu() {
    const user = userEvent.setup()
    await screen.findByText('Bennett Motors')
    const button = screen.getByRole('button', { name: 'Menu' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    return { user, button, panel: screen.getByRole('navigation', { name: 'Main menu' }) }
  }

  it('is closed until the menu button is pressed', async () => {
    signInAsStaff()
    renderLayout()
    await screen.findByText('Bennett Motors')
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument()
  })

  it('lists every section, plus Need Help and Log out', async () => {
    signInAsStaff()
    renderLayout()
    const { panel } = await openMenu()

    for (const [label, path] of [
      ['Dashboard', '/g1/dashboard'],
      ['Customers', '/g1/customers'],
      ['Appointments', '/g1/appointments'],
      ['Requests', '/g1/booking-requests'],
      ['Queue', '/g1/queue'],
      ['Payments', '/g1/payments'],
      ['Communications', '/g1/communications'],
      ['Settings', '/g1/settings'],
    ]) {
      expect(within(panel).getByRole('link', { name: label })).toHaveAttribute('href', path)
    }
    expect(within(panel).getByRole('link', { name: 'Customers' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const panelRoot = document.getElementById('staff-nav-menu')!
    expect(within(panelRoot).getByRole('button', { name: 'Need Help?' })).toBeInTheDocument()
    expect(within(panelRoot).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    signInAsStaff()
    renderLayout()
    const { user, button } = await openMenu()
    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument()
  })

  it('closes on a click outside it', async () => {
    signInAsStaff()
    renderLayout()
    const { user, button } = await openMenu()
    await user.click(screen.getByRole('heading', { name: 'Customers page' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open on a click inside it', async () => {
    signInAsStaff()
    renderLayout()
    const { user, button } = await openMenu()
    await user.click(document.getElementById('staff-nav-menu')!)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles closed from the menu button', async () => {
    signInAsStaff()
    renderLayout()
    const { user, button } = await openMenu()
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes once the user navigates from it', async () => {
    signInAsStaff()
    renderLayout()
    const { user, panel } = await openMenu()
    await user.click(within(panel).getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument()
  })

  it('logs out from the panel', async () => {
    signInAsStaff()
    renderLayout()
    await openMenu()
    const panelRoot = document.getElementById('staff-nav-menu')!
    await userEvent.click(within(panelRoot).getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(getAccessToken()).toBeNull())
  })

  it('has no detectable accessibility violations when open', async () => {
    signInAsStaff()
    const { container } = renderLayout()
    await openMenu()
    await expectNoA11yViolations(container)
  })
})
