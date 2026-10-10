import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'
import { expectNoA11yViolations } from '../test/a11y'

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <Modal open title="Call details" onClose={onClose} {...props}>
      <p>Inbound from 07123 456789</p>
    </Modal>,
  )
  return { onClose, ...utils }
}

describe('Modal', () => {
  it('renders nothing at all when closed', () => {
    render(
      <Modal open={false} title="Call details" onClose={vi.fn()}>
        <p>Inbound from 07123 456789</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes an accessible dialog named by its title', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Call details' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    expect(screen.getByText('Inbound from 07123 456789')).toBeInTheDocument()
  })

  it('closes on the close button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    // The backdrop is the dialog's parent (portalled into <body>).
    await user.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when the panel’s own content is clicked', async () => {
    // Selecting text or clicking a control inside must not dismiss the dialog.
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByText('Inbound from 07123 456789'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stops listening for Escape once closed, so it cannot close a later dialog', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open title="Call details" onClose={onClose}>
        <p>body</p>
      </Modal>,
    )
    rerender(
      <Modal open={false} title="Call details" onClose={onClose}>
        <p>body</p>
      </Modal>,
    )
    await userEvent.setup().keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has no detectable accessibility violations', async () => {
    renderModal()
    await expectNoA11yViolations(screen.getByRole('dialog'))
  })

  it('keeps no separate scroll region without a footer', () => {
    renderModal()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('with a footer, pins it and scrolls only the content, focusing that region', () => {
    renderModal({ footer: <button type="button">Accept</button>, bodyLabel: 'Call notes' })
    const region = screen.getByRole('region', { name: 'Call notes' })
    expect(region).toHaveTextContent('Inbound from 07123 456789')
    expect(region).toHaveClass('overflow-y-auto')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveFocus()
    expect(region).not.toContainElement(screen.getByRole('button', { name: 'Accept' }))
  })

  it('with a footer, has no detectable accessibility violations', async () => {
    renderModal({ footer: <button type="button">Accept</button> })
    await expectNoA11yViolations(screen.getByRole('dialog'))
  })

  it('renders over the whole page, outside any transformed ancestor', () => {
    const { container } = renderModal()
    // Portalled to <body>: a transformed wrapper (e.g. the wizard's step
    // animation) would otherwise clip a fixed overlay to itself.
    expect(container).not.toContainElement(screen.getByRole('dialog'))
    expect(document.body).toContainElement(screen.getByRole('dialog'))
  })
})
