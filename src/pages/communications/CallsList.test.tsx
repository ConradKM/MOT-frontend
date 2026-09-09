import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { CallsList } from './CallsList'
import * as communicationsApi from '../../api/communications'
import type { CommunicationLog } from '../../api/communications'

vi.mock('../../api/communications')

function call(overrides: Partial<CommunicationLog>): CommunicationLog {
  return {
    id: 'call-1',
    channel: 'VOICE',
    direction: 'INBOUND',
    external_provider: 'twilio',
    external_id: 'CA123',
    from_address: '+447123400001',
    to_address: '+441234567890',
    status: 'completed',
    trigger_event: null,
    body: null,
    call_duration_seconds: 90,
    error_code: null,
    error_message: null,
    read_at: null,
    created_at: '2026-09-05T14:00:00+00:00',
    updated_at: '2026-09-05T14:00:00+00:00',
    customer: null,
    appointment: null,
    booking_request: null,
    ...overrides,
  }
}

function render() {
  return renderWithProviders(
    <Routes>
      <Route path="/:garageId/communications/calls" element={<CallsList />} />
    </Routes>,
    { route: '/g/communications/calls' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('CallsList', () => {
  it('resolves a known customer and labels an unmatched number as unknown', async () => {
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({
      total: 2,
      items: [
        call({
          id: 'call-known',
          customer: { id: 'c1', first_name: 'Oliver', last_name: 'Bennett', phone: '+447123400001' },
        }),
        call({ id: 'call-unknown', from_address: '+447123499999', customer: null }),
      ],
    })
    render()

    expect(await screen.findByText('Oliver Bennett')).toBeInTheDocument()
    expect(screen.getByText('+447123499999')).toBeInTheDocument()
  })

  it('shows a MISSED badge for an inbound call that never connected', async () => {
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({
      total: 1,
      items: [call({ id: 'call-missed', direction: 'INBOUND', status: 'no-answer' })],
    })
    render()

    expect(await screen.findByText('MISSED')).toBeInTheDocument()
  })

  it('shows a clean status label for a completed call, not the raw Twilio value', async () => {
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({
      total: 1,
      items: [call({ status: 'completed' })],
    })
    render()

    expect(await screen.findByText('Completed')).toBeInTheDocument()
  })

  it('re-queries with missed_only when the Missed filter is selected', async () => {
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({ total: 0, items: [] })
    const user = userEvent.setup()
    render()
    await screen.findByText('No calls to show yet.')

    await user.click(screen.getByRole('button', { name: 'Missed' }))

    await waitFor(() => {
      const lastCall = vi.mocked(communicationsApi.listCalls).mock.calls.at(-1)?.[0]
      expect(lastCall).toMatchObject({ missed_only: true })
    })
  })

  it('re-queries with the search term after typing (debounced)', async () => {
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({ total: 0, items: [] })
    const user = userEvent.setup()
    render()
    await screen.findByText('No calls to show yet.')

    await user.type(screen.getByPlaceholderText(/Search customer name/), 'Bennett')

    await waitFor(
      () => {
        const lastCall = vi.mocked(communicationsApi.listCalls).mock.calls.at(-1)?.[0]
        expect(lastCall).toMatchObject({ search: 'Bennett' })
      },
      { timeout: 1000 },
    )
  })

  it('expands a row to show call details and technical SID on demand', async () => {
    const row = call({ external_id: 'CAabc123' })
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({ total: 1, items: [row] })
    vi.mocked(communicationsApi.getCall).mockResolvedValue({ ...row, transcript: [] })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByText('View'))
    expect(screen.getByText('Technical details')).toBeInTheDocument()
    expect(screen.queryByText('CAabc123')).not.toBeInTheDocument()

    await user.click(screen.getByText('Technical details'))
    expect(screen.getByText('CAabc123')).toBeInTheDocument()
  })

  it('shows the conversation transcript inside an expanded call', async () => {
    const row = call({ id: 'call-t', external_id: 'CAtranscript' })
    vi.mocked(communicationsApi.listCalls).mockResolvedValue({ total: 1, items: [row] })
    vi.mocked(communicationsApi.getCall).mockResolvedValue({
      ...row,
      transcript: [
        call({ id: 't1', direction: 'INBOUND', body: 'I need an MOT on Friday' }),
        call({ id: 't2', direction: 'OUTBOUND', body: 'For Friday I have 09:00, 09:30 available.' }),
        call({ id: 't3', direction: 'SYSTEM', body: 'Booking request #ab12 created' }),
      ],
    })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByText('View'))

    expect(await screen.findByText('Conversation')).toBeInTheDocument()
    expect(screen.getByText('I need an MOT on Friday')).toBeInTheDocument()
    expect(screen.getByText('Booking request #ab12 created')).toBeInTheDocument()
    expect(screen.getByText('Caller')).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
  })
})
