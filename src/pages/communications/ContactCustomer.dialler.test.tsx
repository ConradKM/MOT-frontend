import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { ContactCustomer } from './ContactCustomer'
import * as communicationsApi from '../../api/communications'
import { ApiError } from '../../api/client'

vi.mock('../../api/communications')
vi.mock('@twilio/voice-sdk')

// --- fakes ---------------------------------------------------------------

class FakeEmitter {
  handlers: Record<string, ((...a: unknown[]) => void)[]> = {}
  on(event: string, cb: (...a: unknown[]) => void) {
    ;(this.handlers[event] ??= []).push(cb)
  }
  emit(event: string, ...args: unknown[]) {
    ;(this.handlers[event] ?? []).forEach((cb) => cb(...args))
  }
}

class FakeCall extends FakeEmitter {
  mute = vi.fn()
  disconnect = vi.fn(() => this.emit('disconnect'))
  sendDigits = vi.fn()
}

class FakeDevice extends FakeEmitter {
  register = vi.fn(async () => this.emit('registered'))
  connect = vi.fn(async () => currentCall)
  destroy = vi.fn()
  disconnectAll = vi.fn()
  updateToken = vi.fn()
}

let currentDevice: FakeDevice
let currentCall: FakeCall

beforeEach(async () => {
  currentCall = new FakeCall()
  currentDevice = new FakeDevice()

  const sdk = await import('@twilio/voice-sdk')
  vi.mocked(sdk.Device).mockImplementation(() => currentDevice as unknown as InstanceType<typeof sdk.Device>)
  // Call.Codec is referenced by the hook's codecPreferences.
  ;(sdk.Call as unknown as { Codec: Record<string, string> }).Codec = { Opus: 'opus', PCMU: 'pcmu' }

  vi.mocked(communicationsApi.getVoiceToken).mockResolvedValue({
    token: 'jwt.token.here',
    identity: 'cbz-abc-def',
    expires_in: 3600,
    caller_id: '+441611234567',
  })
  vi.mocked(communicationsApi.getOverview).mockResolvedValue({
    calls_today: 0,
    missed_calls_today: 0,
    whatsapp_unread: 0,
    outgoing_contacts_today: 0,
    recent: [],
    capabilities: {
      communications_enabled: true,
      voice_number_configured: true,
      whatsapp_configured: true,
      outbound_calling_supported: true,
    },
  })

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
  })
})

afterEach(() => vi.clearAllMocks())

function render(route = '/g1/communications/contact?phone=07123456789&tab=call') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/contact" element={<ContactCustomer />} />
      </Routes>
    </ToastProvider>,
    { route },
  )
}

describe('ContactCustomer — browser dialler', () => {
  it('fetches a token, registers the Device and becomes Ready', async () => {
    render()
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(communicationsApi.getVoiceToken).toHaveBeenCalledTimes(1)
    expect(currentDevice.register).toHaveBeenCalled()
  })

  it('places a call from the entered number and follows the call states', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('Ready')

    await user.click(screen.getByRole('button', { name: 'Place call' }))
    expect(currentDevice.connect).toHaveBeenCalledWith({ params: { To: '07123456789' } })

    currentCall.emit('ringing')
    expect(await screen.findByText('Ringing…')).toBeInTheDocument()

    currentCall.emit('accept')
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('mutes and unmutes while connected', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('Ready')
    await user.click(screen.getByRole('button', { name: 'Place call' }))
    currentCall.emit('accept')
    await screen.findByText('Connected')

    await user.click(screen.getByRole('button', { name: 'Mute' }))
    expect(currentCall.mute).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(currentCall.mute).toHaveBeenLastCalledWith(false)
  })

  it('sends DTMF from the keypad while connected', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('Ready')
    await user.click(screen.getByRole('button', { name: 'Place call' }))
    currentCall.emit('accept')
    await screen.findByText('Connected')

    await user.click(screen.getByRole('button', { name: 'Send 5' }))
    expect(currentCall.sendDigits).toHaveBeenCalledWith('5')
  })

  it('hangs up', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('Ready')
    await user.click(screen.getByRole('button', { name: 'Place call' }))
    currentCall.emit('accept')
    await screen.findByText('Connected')

    await user.click(screen.getByRole('button', { name: 'Hang up' }))
    expect(currentCall.disconnect).toHaveBeenCalled()
    expect(await screen.findByText('Call ended')).toBeInTheDocument()
  })

  it('shows a clear error when microphone access is blocked', async () => {
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    )
    const user = userEvent.setup()
    render()
    await screen.findByText('Ready')
    await user.click(screen.getByRole('button', { name: 'Place call' }))

    expect(await screen.findByText(/Allow microphone access/i)).toBeInTheDocument()
    expect(currentDevice.connect).not.toHaveBeenCalled()
  })

  it('shows a clear error when the token endpoint is not configured', async () => {
    vi.mocked(communicationsApi.getVoiceToken).mockRejectedValueOnce(
      new ApiError({ code: 503, status: 'x', message: 'nope' }, 'nope'),
    )
    render()
    expect(await screen.findByText(/isn't set up for this deployment/i)).toBeInTheDocument()
  })

  it('does not initialise the Device when browser calling is unsupported', async () => {
    vi.mocked(communicationsApi.getOverview).mockResolvedValueOnce({
      calls_today: 0,
      missed_calls_today: 0,
      whatsapp_unread: 0,
      outgoing_contacts_today: 0,
      recent: [],
      capabilities: {
        communications_enabled: true,
        voice_number_configured: false,
        whatsapp_configured: true,
        outbound_calling_supported: false,
      },
    })
    render()
    expect(await screen.findByText(/isn't switched on for your business/i)).toBeInTheDocument()
    expect(communicationsApi.getVoiceToken).not.toHaveBeenCalled()
  })
})


it('does not initialise the Twilio SDK with another provider token', async () => {
  vi.mocked(communicationsApi.getVoiceToken).mockResolvedValue({
    provider: 'future-provider', token: 'other-token', identity: 'other',
    expires_in: 3600, caller_id: '+441611234567',
  })
  render()
  expect(await screen.findByText("Couldn't get a calling token. Please try again.")).toBeInTheDocument()
  expect(currentDevice.register).not.toHaveBeenCalled()
})

it('accepts an explicitly identified Twilio token', async () => {
  vi.mocked(communicationsApi.getVoiceToken).mockResolvedValue({
    provider: 'twilio', token: 'jwt.token.here', identity: 'cbz-abc-def',
    expires_in: 3600, caller_id: '+441611234567',
  })
  render()
  expect(await screen.findByText('Ready')).toBeInTheDocument()
  expect(currentDevice.register).toHaveBeenCalled()
})
