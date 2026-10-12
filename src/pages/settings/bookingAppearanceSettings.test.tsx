import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeGarage } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { BOOKING_BASE_URL } from '../../lib/bookingUrl'
import { SECTIONS } from '../../components/settings/SettingsLayout'
import { BookingAppearanceSettings } from './BookingAppearanceSettings'

function renderSettings() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/booking-appearance" element={<BookingAppearanceSettings />} />
    </Routes>,
    { route: '/g1/settings/booking-appearance' },
  )
}

function withSavedColours(bg: string | null, fg: string | null) {
  server.use(
    http.get('*/api/garage', () =>
      HttpResponse.json(makeGarage({ booking_background_color: bg, booking_text_color: fg })),
    ),
  )
}

/** Echo a successful PUT and capture what was sent. */
function capturePut() {
  const sent: unknown[] = []
  server.use(
    http.put('*/api/garage/booking-appearance', async ({ request }) => {
      const body = (await request.json()) as Record<string, string | null>
      sent.push(body)
      return HttpResponse.json(makeGarage(body))
    }),
  )
  return sent
}

async function setHex(label: 'Page background' | 'Page text', value: string) {
  const user = userEvent.setup()
  const box = await screen.findByLabelText(label)
  await user.clear(box)
  if (value) await user.type(box, value)
  return user
}

const preview = () => screen.getByTestId('booking-preview').firstElementChild as HTMLElement

describe('BookingAppearanceSettings', () => {
  it('is listed in the settings sidebar under Appointments', () => {
    const appointments = SECTIONS.find((s) => s.group === 'Appointments')
    expect(appointments?.items.map((i) => i.slug)).toContain('booking-appearance')
  })

  it('starts from the default colours, says what changes and links the real page', async () => {
    renderSettings()
    expect(await screen.findByLabelText('Page background')).toHaveValue('#f4f4f4')
    expect(screen.getByLabelText('Page text')).toHaveValue('#242424')
    expect(screen.getByText(/cards and forms\s+stay white/)).toBeInTheDocument()
    expect(screen.getByText('Your pages use the default colours.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Preview real page/ })).toHaveAttribute(
      'href',
      `${BOOKING_BASE_URL}/book/g1`,
    )
  })

  it('loads the saved colours into the pickers and the preview', async () => {
    withSavedColours('#0b1f3a', '#f5f7fa')
    renderSettings()
    expect(await screen.findByLabelText('Page background')).toHaveValue('#0b1f3a')
    expect(preview().style.getPropertyValue('--page-bg')).toBe('#0b1f3a')
  })

  it('updates the contrast readout and the preview live', async () => {
    renderSettings()
    await setHex('Page background', '#0b1f3a')
    await setHex('Page text', '#f5f7fa')

    expect(screen.getByTestId('contrast-readout')).toHaveTextContent('Contrast 15.3:1, passes')
    expect(preview().style.getPropertyValue('--page-fg')).toBe('#f5f7fa')
  })

  it('keeps the colour picker in sync with the hex box', async () => {
    renderSettings()
    await setHex('Page background', '#0B1F3A')
    expect(screen.getByLabelText('Page background colour picker')).toHaveValue('#0b1f3a')
  })

  it('turns Save off, with a reason, while contrast fails', async () => {
    renderSettings()
    await setHex('Page background', '#ffffff')
    await setHex('Page text', '#777777')

    expect(screen.getByTestId('contrast-readout')).toHaveTextContent(
      'Contrast 4.4:1, too low: needs at least 4.5:1',
    )
    const save = screen.getByRole('button', { name: 'Save colours' })
    expect(save).toBeDisabled()
    expect(save).toHaveAccessibleDescription(/contrast is at least 4.5:1/)
    // A failing pair previews as the real page would render it: the default.
    expect(preview()).toHaveAttribute('data-booking-theme', 'default')
  })

  it('turns Save off while a value is not 6-digit hex', async () => {
    renderSettings()
    await setHex('Page text', '#fff')

    expect(screen.getByText('Use a 6-digit hex colour like #1a2b3c.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save colours' })).toBeDisabled()
  })

  it('applies a preset and saves it lowercased, with a toast', async () => {
    const sent = capturePut()
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Midnight' }))
    expect(screen.getByLabelText('Page background')).toHaveValue('#0b1f3a')

    await user.click(screen.getByRole('button', { name: 'Save colours' }))

    expect(await screen.findByText('Booking page colours saved.')).toBeInTheDocument()
    expect(sent).toEqual([{ booking_background_color: '#0b1f3a', booking_text_color: '#f5f7fa' }])
  })

  it('Reset to default clears both colours', async () => {
    withSavedColours('#0b1f3a', '#f5f7fa')
    const sent = capturePut()
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Reset to default' }))

    expect(await screen.findByText('Booking page colours reset to the default.')).toBeInTheDocument()
    expect(sent).toEqual([{ booking_background_color: null, booking_text_color: null }])
    await waitFor(() => expect(screen.getByLabelText('Page background')).toHaveValue('#f4f4f4'))
  })

  it('explains a 403 for a non-owner', async () => {
    server.use(
      http.put('*/api/garage/booking-appearance', () =>
        HttpResponse.json({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Midnight' }))
    await user.click(screen.getByRole('button', { name: 'Save colours' }))
    expect(
      await screen.findByText('Only the business owner can change the booking page colours.'),
    ).toBeInTheDocument()
  })

  it('shows the server contrast message inline', async () => {
    server.use(
      http.put('*/api/garage/booking-appearance', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            message: 'Text and background contrast is 4.48:1; it needs to be at least 4.5:1 so customers can read it.',
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Cream' }))
    await user.click(screen.getByRole('button', { name: 'Save colours' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('contrast is 4.48:1')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderSettings()
    await screen.findByLabelText('Page background')
    await expectNoA11yViolations(container)
  })
})
