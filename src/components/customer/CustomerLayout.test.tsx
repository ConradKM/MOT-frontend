import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { GARAGE_ID, TERMS_TEXT, makePublicGarage } from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { CustomerLayout } from './CustomerLayout'
import { useReportThemeGarage } from './bookingThemeContext'

/** Stands in for a customer-portal page: no :garageId, but its own data
 * names the business. */
function PortalPage() {
  useReportThemeGarage(GARAGE_ID)
  return <h1>Portal</h1>
}

function renderAt(route: string) {
  return renderWithAppProviders(
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/book" element={<h1>Booking</h1>} />
        <Route path="/book/:garageId" element={<h1>Booking</h1>} />
        <Route path="/queue/:garageId" element={<h1>Queue</h1>} />
        <Route path="/terms/:garageId" element={<h1>Terms</h1>} />
        <Route path="/customer/account" element={<h1>Account</h1>} />
        <Route path="/customer/appointments/x" element={<PortalPage />} />
      </Route>
    </Routes>,
    { route },
  )
}

const DARK = { booking_background_color: '#0b1f3a', booking_text_color: '#f5f7fa' }

function serveGarage(patch: Parameters<typeof makePublicGarage>[0]) {
  server.use(http.get('*/api/public/garages/:id', () => HttpResponse.json(makePublicGarage(patch))))
}

function themeRoot(): HTMLElement {
  return document.querySelector('[data-booking-theme]') as HTMLElement
}

describe('CustomerLayout footer', () => {
  it('links the business terms when it has them', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json(makePublicGarage({ terms_and_conditions: TERMS_TEXT, terms_version: 1 })),
      ),
    )
    renderAt(`/book/${GARAGE_ID}`)
    expect(await screen.findByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute(
      'href',
      `/terms/${GARAGE_ID}`,
    )
  })

  it('has no terms link when the business has none', async () => {
    let served = false
    server.use(
      http.get('*/api/public/garages/:id', () => {
        served = true
        return HttpResponse.json(makePublicGarage())
      }),
    )
    renderAt(`/book/${GARAGE_ID}`)
    // Assert absence only once the garage has actually been loaded.
    await waitFor(() => expect(served).toBe(true))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument()
  })

  it('has no terms link off a business-specific page', async () => {
    renderAt('/customer/account')
    await screen.findByRole('heading', { name: 'Account' })
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument()
  })
})

describe('CustomerLayout booking colours', () => {
  it.each([`/book/${GARAGE_ID}`, `/queue/${GARAGE_ID}`, `/terms/${GARAGE_ID}`])(
    'themes %s with the business colours',
    async (route) => {
      serveGarage(DARK)
      renderAt(route)
      await waitFor(() => expect(themeRoot()).toHaveAttribute('data-booking-theme', 'custom'))
      expect(themeRoot().style.getPropertyValue('--page-bg')).toBe('#0b1f3a')
      // The header joins the page rather than staying a white bar.
      expect(screen.getByRole('banner')).not.toHaveClass('bg-white')
    },
  )

  it('keeps the default look, white header included, for a business without colours', async () => {
    let served = false
    server.use(
      http.get('*/api/public/garages/:id', () => {
        served = true
        return HttpResponse.json(makePublicGarage())
      }),
    )
    renderAt(`/book/${GARAGE_ID}`)
    await waitFor(() => expect(served).toBe(true))
    await new Promise((r) => setTimeout(r, 0))
    expect(themeRoot()).toHaveAttribute('data-booking-theme', 'default')
    expect(screen.getByRole('banner')).toHaveClass('bg-white')
  })

  it('ignores colours from the API that fail contrast', async () => {
    serveGarage({ booking_background_color: '#ffffff', booking_text_color: '#eeeeee' })
    renderAt(`/book/${GARAGE_ID}`)
    await screen.findByRole('heading', { name: 'Booking' })
    await new Promise((r) => setTimeout(r, 0))
    expect(themeRoot()).toHaveAttribute('data-booking-theme', 'default')
  })

  it.each(['/book', '/customer/account'])('leaves %s, which names no business, on the default', async (route) => {
    serveGarage(DARK)
    renderAt(route)
    await screen.findByRole('heading')
    expect(themeRoot()).toHaveAttribute('data-booking-theme', 'default')
  })

  it('themes a portal page from the business it reports', async () => {
    serveGarage(DARK)
    renderAt('/customer/appointments/x')
    await waitFor(() => expect(themeRoot()).toHaveAttribute('data-booking-theme', 'custom'))
  })

  it('paints the last-seen colours from the first frame, then caches what the API says', async () => {
    localStorage.setItem(
      `comaz:booking-theme:${GARAGE_ID}`,
      JSON.stringify({ background: '#111827', text: '#f9fafb' }),
    )
    serveGarage(DARK)
    renderAt(`/book/${GARAGE_ID}`)
    expect(themeRoot().style.getPropertyValue('--page-bg')).toBe('#111827')

    await waitFor(() => expect(themeRoot().style.getPropertyValue('--page-bg')).toBe('#0b1f3a'))
    expect(JSON.parse(localStorage.getItem(`comaz:booking-theme:${GARAGE_ID}`)!)).toEqual({
      background: '#0b1f3a',
      text: '#f5f7fa',
    })
  })

  it('clears the cached colours once the business resets them', async () => {
    localStorage.setItem(
      `comaz:booking-theme:${GARAGE_ID}`,
      JSON.stringify({ background: '#111827', text: '#f9fafb' }),
    )
    serveGarage({})
    renderAt(`/book/${GARAGE_ID}`)
    await waitFor(() => expect(themeRoot()).toHaveAttribute('data-booking-theme', 'default'))
    expect(localStorage.getItem(`comaz:booking-theme:${GARAGE_ID}`)).toBeNull()
  })
})
