import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { CommunicationsAutomationSettings } from './CommunicationsAutomationSettings'
import * as communicationsApi from '../../api/communications'
import { ApiError } from '../../api/client'

vi.mock('../../api/communications')

const SETTINGS: communicationsApi.AutomationSettings = {
  booking_ack_enabled: true,
  booking_confirmation_enabled: true,
  reminder_enabled: true,
  reminder_hours_before: 24,
  missed_call_ack_enabled: false,
  conversation_automation_enabled: false,
}

const TEMPLATE: communicationsApi.MessageTemplate = {
  key: 'booking_acknowledgement',
  body: 'Thanks for your booking request with {{business_name}}.',
  default_body: 'Thanks for your booking request with {{business_name}}.',
  is_custom: false,
}

function render(templates: communicationsApi.MessageTemplate[] = [{ ...TEMPLATE }]) {
  vi.mocked(communicationsApi.getAutomationSettings).mockResolvedValue({ ...SETTINGS })
  vi.mocked(communicationsApi.listTemplates).mockResolvedValue({ items: templates })
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route
          path="/:garageId/settings/communications-automation"
          element={<CommunicationsAutomationSettings />}
        />
      </Routes>
    </ToastProvider>,
    { route: '/g/settings/communications-automation' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('CommunicationsAutomationSettings', () => {
  it('shows the current toggles, off by default for the automated assistant', async () => {
    render()
    const assistantToggle = await screen.findByRole('checkbox', {
      name: /automated whatsapp assistant/i,
    })
    expect(assistantToggle).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /booking request received/i })).toBeChecked()
  })

  it('saves a toggle change', async () => {
    vi.mocked(communicationsApi.updateAutomationSettings).mockResolvedValue({
      ...SETTINGS,
      conversation_automation_enabled: true,
    })
    const user = userEvent.setup()
    render()

    await user.click(
      await screen.findByRole('checkbox', { name: /automated whatsapp assistant/i }),
    )
    await user.click(screen.getByRole('button', { name: /save automation settings/i }))

    await waitFor(() =>
      expect(communicationsApi.updateAutomationSettings).toHaveBeenCalledWith(
        expect.objectContaining({ conversation_automation_enabled: true }),
      ),
    )
  })

  it('shows a specific message on a 403 rather than a generic error', async () => {
    vi.mocked(communicationsApi.updateAutomationSettings).mockRejectedValue(
      new ApiError({ code: 403, status: 'Forbidden', message: 'Owner only' }, 'fail'),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /save automation settings/i }))

    expect(await screen.findByText(/only the business owner/i)).toBeInTheDocument()
  })

  it('edits, previews and saves a message template', async () => {
    vi.mocked(communicationsApi.previewTemplate).mockResolvedValue({
      preview: 'Thanks for your booking request with Kingsway MOT.',
    })
    vi.mocked(communicationsApi.updateTemplate).mockResolvedValue({
      ...TEMPLATE,
      body: 'Cheers for booking with {{business_name}}!',
      is_custom: true,
    })
    const user = userEvent.setup()
    render()

    const textarea = await screen.findByDisplayValue(TEMPLATE.body)
    await user.clear(textarea)
    // userEvent.type() treats `{` (not `}`) as special-key syntax - `{{` is
    // the escape for one literal `{`, so this actually types
    // "Cheers for booking with {{business_name}}!".
    await user.type(textarea, 'Cheers for booking with {{{{business_name}}!')

    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(
      await screen.findByText('Thanks for your booking request with Kingsway MOT.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(communicationsApi.updateTemplate).toHaveBeenCalledWith(
      'booking_acknowledgement',
      'Cheers for booking with {{business_name}}!',
    )
  })

  it('offers to reset only once a template is customised', async () => {
    render([{ ...TEMPLATE, body: 'Custom text', is_custom: true }])

    expect(await screen.findByText('Customised')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument()
  })
})
