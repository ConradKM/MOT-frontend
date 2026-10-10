import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { TermsAcceptance } from './TermsAcceptance'

const TERMS = 'Line one.\nLine two <b>not bold</b>.'

function Harness({ error, onChange }: { error?: string; onChange?: (v: boolean) => void }) {
  const [accepted, setAccepted] = useState(false)
  return (
    <TermsAcceptance
      terms={TERMS}
      garageId="gid"
      accepted={accepted}
      onChange={(v) => {
        setAccepted(v)
        onChange?.(v)
      }}
      error={error}
    />
  )
}

const checkbox = () => screen.getByRole('checkbox', { name: /I have read and accept the/ })
const link = () => screen.getByRole('button', { name: 'terms and conditions' })

describe('TermsAcceptance', () => {
  it('ticks directly, without opening the terms', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(checkbox())
    expect(checkbox()).toBeChecked()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the terms in a popup with its own labelled, focusable scroll region', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(link())

    const dialog = screen.getByRole('dialog', { name: 'Terms and conditions' })
    expect(dialog).toBeInTheDocument()
    const region = screen.getByRole('region', { name: 'Terms and conditions text' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveFocus()
    // Accept/Close live outside the scrolling text, so they never scroll away.
    expect(region).not.toContainElement(screen.getByRole('button', { name: 'Accept' }))
    // Opening the terms is not acceptance.
    expect(checkbox()).not.toBeChecked()
  })

  it('renders the terms as plain text with line breaks, never as HTML', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(link())
    const region = screen.getByRole('region', { name: 'Terms and conditions text' })
    expect(region.textContent).toContain('Line two <b>not bold</b>.')
    expect(region.querySelector('b')).toBeNull()
    expect(region.firstElementChild).toHaveClass('whitespace-pre-wrap')
  })

  it('Accept ticks the box, closes, and returns focus to the link', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(link())
    await user.click(screen.getByRole('button', { name: 'Accept' }))

    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(checkbox()).toBeChecked()
    await waitFor(() => expect(link()).toHaveFocus())
  })

  it('Close leaves the box unticked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(link())
    // The footer's text button - the header's ✕ shares the accessible name.
    await user.click(screen.getByText('Close', { selector: 'button' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(checkbox()).not.toBeChecked()
    await waitFor(() => expect(link()).toHaveFocus())
  })

  it('Escape closes without accepting and returns focus', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(link())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(checkbox()).not.toBeChecked()
    await waitFor(() => expect(link()).toHaveFocus())
  })

  it('offers the standalone page in a new tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(link())
    const newTab = screen.getByRole('link', { name: 'Open in new tab' })
    expect(newTab).toHaveAttribute('href', '/terms/gid')
    expect(newTab).toHaveAttribute('target', '_blank')
  })

  it('ties a validation message to the checkbox', () => {
    renderWithProviders(<Harness error="Please accept the terms and conditions to continue." />)
    expect(checkbox()).toHaveAttribute('aria-invalid', 'true')
    expect(checkbox()).toHaveAccessibleDescription(
      'Please accept the terms and conditions to continue.',
    )
  })

  it('has no axe violations, closed or open', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Harness error="Required." />)
    await expectNoA11yViolations(container)
    await user.click(link())
    await expectNoA11yViolations(screen.getByRole('dialog'))
  })
})
