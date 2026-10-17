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
    expect(screen.getByText(/cards and forms\s+stay white/)).toBeVisible()
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

  it('rates readability in plain words, with a live sample and the ratio in a tip', async () => {
    renderSettings()
    await setHex('Page background', '#0b1f3a')
    await setHex('Page text', '#f5f7fa')

    const readout = screen.getByTestId('contrast-readout')
    expect(readout).toHaveTextContent('Easy to read')
    expect(readout).not.toHaveTextContent(/:1/)
    expect(readout).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('readability-sample')).toHaveStyle({
      backgroundColor: '#0b1f3a',
      color: '#f5f7fa',
    })
    expect(screen.getByRole('button', { name: 'About readability' })).toHaveAccessibleDescription(
      /Contrast ratio 15\.3:1/,
    )
    expect(preview().style.getPropertyValue('--page-fg')).toBe('#f5f7fa')
  })

  it('calls a pair between the AA bar and 7:1 "Readable"', async () => {
    renderSettings()
    await setHex('Page background', '#ffffff')
    await setHex('Page text', '#666666')
    expect(screen.getByTestId('contrast-readout')).toHaveTextContent('Readable')
    expect(screen.getByRole('button', { name: 'Save colours' })).toBeEnabled()
  })

  it('suggests the fix in the right direction for a dark page', async () => {
    renderSettings()
    await setHex('Page background', '#333333')
    await setHex('Page text', '#555555')
    expect(screen.getByTestId('contrast-readout')).toHaveTextContent(
      'Hard to read: try a darker background or lighter text.',
    )
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
      'Hard to read: try a lighter background or darker text.',
    )
    const save = screen.getByRole('button', { name: 'Save colours' })
    expect(save).toBeDisabled()
    expect(save).toHaveAccessibleDescription(/until the text is easy enough to read/)
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

describe('BookingAppearanceSettings — Black & white preset', () => {
  it('applies a black page with white text', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Black & white' }))
    expect(screen.getByLabelText('Page background')).toHaveValue('#000000')
    expect(screen.getByLabelText('Page text')).toHaveValue('#ffffff')
    expect(screen.getByTestId('contrast-readout')).toHaveTextContent('Easy to read')
  })
})
