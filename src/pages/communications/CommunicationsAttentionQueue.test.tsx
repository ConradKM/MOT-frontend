import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { CommunicationsAttentionQueue } from './CommunicationsAttentionQueue'
import * as communicationsApi from '../../api/communications'

vi.mock('../../api/communications')

function render() {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/attention" element={<CommunicationsAttentionQueue />} />
      </Routes>
    </ToastProvider>,
    { route: '/g/communications/attention' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('CommunicationsAttentionQueue', () => {
  it('shows an empty state when nothing needs attention', async () => {
    vi.mocked(communicationsApi.listAttentionQueue).mockResolvedValue({ items: [] })
    render()
    expect(await screen.findByText(/nothing needs attention/i)).toBeInTheDocument()
  })

  it('lists a handed-off conversation with its reason and a way to resume or open it', async () => {
    vi.mocked(communicationsApi.listAttentionQueue).mockResolvedValue({
      items: [
        {
          phone: '+447123456789',
          customer: { id: 'c1', first_name: 'Jane', last_name: 'Doe', phone: '+447123456789' },
          intent: 'SPEAK_TO_HUMAN',
          handoff_reason: 'Customer asked for a person.',
          last_activity_at: '2026-09-05T19:00:00+00:00',
        },
      ],
    })
    render()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Customer asked for a person.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open conversation/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('+447123456789')),
    )
  })

  it('resumes automation for a conversation from the queue', async () => {
    vi.mocked(communicationsApi.listAttentionQueue).mockResolvedValue({
      items: [
        {
          phone: '+447123456789',
          customer: null,
          intent: 'UNKNOWN',
          handoff_reason: 'Repeated failed intent detection.',
          last_activity_at: '2026-09-05T19:00:00+00:00',
        },
      ],
    })
    vi.mocked(communicationsApi.resumeConversationAutomation).mockResolvedValue({
      phone: '+447123456789', status: 'ACTIVE', intent: null, handoff_reason: null,
    })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /resume automation/i }))

    await waitFor(() =>
      expect(communicationsApi.resumeConversationAutomation).toHaveBeenCalledWith('+447123456789'),
    )
  })
})
