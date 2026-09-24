import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { PhoneMenuPanel } from './PhoneMenuPanel'
import * as voiceMenuApi from '../../api/voiceMenu'
import { ApiError } from '../../api/client'

vi.mock('../../api/voiceMenu')

const ACTIONS: voiceMenuApi.VoiceMenuActionInfo[] = [
  { key: 'AI_BOOKING', label: 'AI booking assistant', accepts_target: false, can_be_fallback: true, available: true },
  { key: 'AI_FAQ', label: 'AI questions assistant', accepts_target: false, can_be_fallback: true, available: true },
  { key: 'HUMAN_TRANSFER', label: 'Transfer to a person', accepts_target: true, can_be_fallback: true, available: true },
  { key: 'REPEAT_MENU', label: 'Repeat the menu', accepts_target: false, can_be_fallback: false, available: true },
]

const EMPTY: voiceMenuApi.VoiceMenu = {
  enabled: false,
  greeting: null,
  options: [],
  fallback_action: 'HUMAN_TRANSFER',
  fallback_target: null,
  max_attempts: 2,
  ai_available: true,
  platform_transfer_configured: false,
  supported_actions: ACTIONS,
}

function render(menu: voiceMenuApi.VoiceMenu = EMPTY) {
  vi.mocked(voiceMenuApi.getVoiceMenu).mockResolvedValue(menu)
  return renderWithProviders(
    <ToastProvider>
      <PhoneMenuPanel businessName="Tints On Demand" />
    </ToastProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('PhoneMenuPanel', () => {
  it('starts off, suggesting press 1 for bookings and press 2 for the team', async () => {
    render()
    expect(
      await screen.findByRole('checkbox', { name: /play a phone menu/i }),
    ).not.toBeChecked()
    expect(screen.getAllByTestId('phone-menu-option')).toHaveLength(2)
    expect(screen.getByTestId('phone-menu-preview')).toHaveTextContent(
      'Thanks for calling Tints On Demand. For bookings, press 1. For the team, press 2.',
    )
  })

  it('only offers a transfer number on transfer options', async () => {
    render()
    await screen.findAllByTestId('phone-menu-option')
    expect(screen.queryByLabelText('Option 1 transfer number')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Option 2 transfer number')).toBeInTheDocument()
  })

  it('saves the menu the owner configured', async () => {
    vi.mocked(voiceMenuApi.updateVoiceMenu).mockResolvedValue({ ...EMPTY, enabled: true })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('checkbox', { name: /play a phone menu/i }))
    await user.type(screen.getByLabelText('Option 2 transfer number'), '0161 222 3333')
    await user.click(screen.getByRole('button', { name: /save phone menu/i }))

    await waitFor(() => expect(voiceMenuApi.updateVoiceMenu).toHaveBeenCalled())
    const sent = vi.mocked(voiceMenuApi.updateVoiceMenu).mock.calls[0][0]
    expect(sent.enabled).toBe(true)
    expect(sent.options).toEqual([
      { digit: '1', label: 'bookings', prompt: null, action: 'AI_BOOKING', target: null },
      { digit: '2', label: 'the team', prompt: null, action: 'HUMAN_TRANSFER', target: '0161 222 3333' },
    ])
  })

  it('never offers a key that another option already uses', async () => {
    render()
    const [first] = await screen.findAllByTestId('phone-menu-option')
    const keys = within(first).getByLabelText('Option 1 key')
    expect(within(keys).queryByRole('option', { name: '2' })).not.toBeInTheDocument()
  })

  it("can't choose repeat-the-menu as the fallback", async () => {
    render()
    const fallback = await screen.findByLabelText('Fallback action')
    expect(within(fallback).queryByRole('option', { name: /repeat/i })).not.toBeInTheDocument()
  })

  it('shows the field error the server returns', async () => {
    vi.mocked(voiceMenuApi.updateVoiceMenu).mockRejectedValue(
      new ApiError(
        {
          code: 422,
          status: 'Unprocessable Entity',
          message: 'Premium-rate numbers can not be used.',
          errors: { json: { 'options.1.target': ['Premium-rate numbers can not be used.'] } },
        },
        'fail',
      ),
    )
    const user = userEvent.setup()
    render()
    await user.type(await screen.findByLabelText('Option 2 transfer number'), '09011234567')
    await user.click(screen.getByRole('button', { name: /save phone menu/i }))
    expect(await screen.findAllByText(/premium-rate numbers/i)).not.toHaveLength(0)
  })

  it('warns when the assistant is chosen but not switched on yet', async () => {
    render({ ...EMPTY, ai_available: false })
    expect(await screen.findByText(/isn't switched on for your number yet/i)).toBeInTheDocument()
  })

  it('explains a 403 as owner-only', async () => {
    vi.mocked(voiceMenuApi.updateVoiceMenu).mockRejectedValue(
      new ApiError({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, 'fail'),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: /save phone menu/i }))
    expect(await screen.findByText(/only the business owner/i)).toBeInTheDocument()
  })
})
