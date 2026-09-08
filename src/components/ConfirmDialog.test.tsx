import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'
import { expectNoA11yViolations } from '../test/a11y'

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const utils = render(
    <ConfirmDialog
      open
      title="Send MOT reminder?"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      This texts the customer straight away.
    </ConfirmDialog>,
  )
  return { onConfirm, onCancel, ...utils }
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the title, body and both actions', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Send MOT reminder?' })).toBeInTheDocument()
    expect(screen.getByText('This texts the customer straight away.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('moves focus to the confirm button so it is operable from the keyboard', () => {
    // Focus management is the whole reason this is a component and not an inline div.
    renderDialog()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
  })

  it('confirms when the confirm button is activated', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('can be confirmed with the keyboard alone', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    await user.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels on the cancel button, Escape, and a backdrop click', async () => {
    const user = userEvent.setup()
    const { onCancel, container } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    await user.click(container.firstElementChild as HTMLElement)

    expect(onCancel).toHaveBeenCalledTimes(3)
  })

  it('uses the caller’s own action labels', () => {
    renderDialog({ confirmLabel: 'Send reminder', cancelLabel: 'Not now' })
    expect(screen.getByRole('button', { name: 'Send reminder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })

  it('disables both actions while the confirmed work is in flight', async () => {
    // Guards against a double-send from an impatient second click.
    const user = userEvent.setup()
    const { onConfirm, onCancel } = renderDialog({ busy: true, confirmLabel: 'Send reminder' })

    const confirm = screen.getByRole('button', { name: 'Sending…' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderDialog({ danger: true })
    await expectNoA11yViolations(container)
  })
})
