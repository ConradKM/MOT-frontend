import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

function Trigger() {
  const { showToast } = useToast()
  return (
    <>
      <button onClick={() => showToast('Could not save.')}>fail</button>
      <button onClick={() => showToast('Customer created.', 'success')}>succeed</button>
    </>
  )
}

const renderToasts = () =>
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )

describe('ToastProvider', () => {
  it('shows nothing until something is announced', () => {
    renderToasts()
    expect(screen.queryByText('Could not save.')).not.toBeInTheDocument()
  })

  it('announces a message on request', async () => {
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(screen.getByText('Could not save.')).toBeInTheDocument()
  })

  it('stacks several messages rather than replacing the previous one', async () => {
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'fail' }))
    await user.click(screen.getByRole('button', { name: 'succeed' }))
    expect(screen.getByText('Could not save.')).toBeInTheDocument()
    expect(screen.getByText('Customer created.')).toBeInTheDocument()
  })

  it('keeps identical messages distinct instead of collapsing them', async () => {
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'fail' }))
    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(screen.getAllByText('Could not save.')).toHaveLength(2)
  })

  it('tells a developer when the hook is used outside its provider', () => {
    expect(() => render(<Trigger />)).toThrow(/useToast must be used within ToastProvider/)
  })
})

describe('ToastProvider — auto-dismissal', () => {
  // These two own the clock outright, so they click with fireEvent rather than
  // user-event — user-event's internal waits need a clock that advances on its
  // own, which would make the 5s boundary below race.
  beforeEach(() => vi.useFakeTimers())

  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  afterEach(() => vi.useRealTimers())

  it('dismisses a message on its own after five seconds', () => {
    renderToasts()
    click('fail')
    expect(screen.getByText('Could not save.')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(4999))
    expect(screen.getByText('Could not save.')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Could not save.')).not.toBeInTheDocument()
  })

  it('expires each message on its own timer, not the newest one’s', () => {
    renderToasts()
    click('fail')
    act(() => vi.advanceTimersByTime(3000))
    click('succeed')

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByText('Could not save.')).not.toBeInTheDocument()
    expect(screen.getByText('Customer created.')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByText('Customer created.')).not.toBeInTheDocument()
  })
})
