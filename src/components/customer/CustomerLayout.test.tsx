import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { GARAGE_ID, TERMS_TEXT, makePublicGarage } from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { CustomerLayout } from './CustomerLayout'

function renderAt(route: string) {
  return renderWithAppProviders(
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/book/:garageId" element={<h1>Booking</h1>} />
        <Route path="/customer/account" element={<h1>Account</h1>} />
      </Route>
    </Routes>,
    { route },
  )
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
