import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { CallbackRequestsList } from './CallbackRequestsList'
import * as communicationsApi from '../../api/communications'
import type { CallbackRequest } from '../../api/communications'

vi.mock('../../api/communications')

function callback(overrides: Partial<CallbackRequest> = {}): CallbackRequest {
  return {
    id: 'cb-1',
    customer: null,
    phone_number: '+447123456789',
    reason: "my car won't start",
    preferred_time: null,
    status: 'PENDING',
    created_at: '2026-09-05T19:00:00+00:00',
    ...overrides,
  }
}

function render() {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/callbacks" element={<CallbackRequestsList />} />
      </Routes>
    </ToastProvider>,
    { route: '/g/communications/callbacks' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('CallbackRequestsList', () => {
  it('lists pending callback requests by default', async () => {
    vi.mocked(communicationsApi.listCallbackRequests).mockResolvedValue({
      items: [callback()],
      total: 1,
    })
    render()

    expect(await screen.findByText("my car won't start")).toBeInTheDocument()
    expect(communicationsApi.listCallbackRequests).toHaveBeenCalledWith({ status: 'PENDING' })
  })

  it('marks a callback as done', async () => {
    vi.mocked(communicationsApi.listCallbackRequests).mockResolvedValue({
      items: [callback()],
      total: 1,
    })
    vi.mocked(communicationsApi.completeCallbackRequest).mockResolvedValue(
      callback({ status: 'COMPLETED' }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /^done$/i }))

    await waitFor(() => expect(communicationsApi.completeCallbackRequest).toHaveBeenCalledWith('cb-1'))
  })

  it('switches tabs and re-queries by status', async () => {
    vi.mocked(communicationsApi.listCallbackRequests).mockResolvedValue({ items: [], total: 0 })
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /^completed$/i }))

    await waitFor(() =>
      expect(communicationsApi.listCallbackRequests).toHaveBeenCalledWith({ status: 'COMPLETED' }),
    )
  })
})
