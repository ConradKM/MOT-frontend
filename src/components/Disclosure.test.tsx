import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Disclosure } from './Disclosure'
import { expectNoA11yViolations } from '../test/a11y'

const renderDisclosure = (defaultOpen = false) =>
  render(
    <Disclosure title="Opening hours" defaultOpen={defaultOpen}>
      <p>Mon–Fri, 08:30–17:00</p>
    </Disclosure>,
  )

describe('Disclosure', () => {
  it('starts collapsed, with its state announced to assistive tech', () => {
    renderDisclosure()
    expect(screen.getByRole('button', { name: /opening hours/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('Mon–Fri, 08:30–17:00')).not.toBeInTheDocument()
  })

  it('can start expanded', () => {
    renderDisclosure(true)
    expect(screen.getByRole('button', { name: /opening hours/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('Mon–Fri, 08:30–17:00')).toBeInTheDocument()
  })

  it('toggles its content open and shut', async () => {
    const user = userEvent.setup()
    renderDisclosure()
    const header = screen.getByRole('button', { name: /opening hours/i })

    await user.click(header)
    expect(screen.getByText('Mon–Fri, 08:30–17:00')).toBeInTheDocument()
    expect(header).toHaveAttribute('aria-expanded', 'true')

    await user.click(header)
    expect(screen.queryByText('Mon–Fri, 08:30–17:00')).not.toBeInTheDocument()
  })

  it('can be operated from the keyboard', async () => {
    const user = userEvent.setup()
    renderDisclosure()
    await user.tab()
    expect(screen.getByRole('button', { name: /opening hours/i })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Mon–Fri, 08:30–17:00')).toBeInTheDocument()
  })

  it('has no detectable accessibility violations in either state', async () => {
    const { container, rerender } = renderDisclosure()
    await expectNoA11yViolations(container)
    rerender(
      <Disclosure title="Opening hours" defaultOpen>
        <p>Mon–Fri, 08:30–17:00</p>
      </Disclosure>,
    )
    await expectNoA11yViolations(container)
  })
})
