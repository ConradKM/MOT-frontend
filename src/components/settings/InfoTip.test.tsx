import { describe, expect, it } from 'vitest'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InfoTip } from './InfoTip'
import { expectNoA11yViolations } from '../../test/a11y'

const renderTip = () =>
  render(
    <div>
      <p>Slot length</p>
      <InfoTip label="Slot length">How often a bookable start time appears.</InfoTip>
      <button type="button">Elsewhere</button>
    </div>,
  )

const tipButton = () => screen.getByRole('button', { name: 'About Slot length' })

/** jsdom has no PointerEvent, so `pointerType` has to be put on by hand. */
function touchDown(el: HTMLElement) {
  const event = createEvent.pointerDown(el)
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  fireEvent(el, event)
}

describe('InfoTip', () => {
  it('is described by its text even while hidden, so a screen reader hears it on focus', () => {
    renderTip()
    expect(tipButton()).toHaveAccessibleDescription('How often a bookable start time appears.')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on hover and stays open while the pointer is over the tip itself', async () => {
    const user = userEvent.setup()
    renderTip()
    await user.hover(tipButton())
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('How often a bookable start time appears.')

    // Moving from the icon onto the tip must not dismiss it (WCAG 1.4.13).
    await user.hover(tip)
    await act(() => new Promise((r) => setTimeout(r, 200)))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    await user.unhover(tip)
    await act(() => new Promise((r) => setTimeout(r, 200)))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on keyboard focus and closes on Escape', async () => {
    const user = userEvent.setup()
    renderTip()
    await user.tab()
    expect(tipButton()).toHaveFocus()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    // Escape dismisses without moving focus.
    expect(tipButton()).toHaveFocus()
  })

  it('toggles on tap, for touch screens with no hover', () => {
    renderTip()
    const button = tipButton()
    const tap = () => {
      touchDown(button)
      fireEvent.focus(button)
      fireEvent.click(button)
    }
    tap()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    tap()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on a tap outside', () => {
    renderTip()
    touchDown(tipButton())
    fireEvent.click(tipButton())
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByText('Slot length'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations when open', async () => {
    const user = userEvent.setup()
    const { container } = renderTip()
    await user.hover(tipButton())
    await expectNoA11yViolations(container)
  })
})
