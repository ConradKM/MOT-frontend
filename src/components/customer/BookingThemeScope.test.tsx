import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookingThemeScope } from './BookingThemeScope'
import { useIsBookingThemed } from './bookingThemeContext'

function Probe() {
  return <p>{useIsBookingThemed() ? 'themed' : 'default'}</p>
}

function renderScope(background: string | null, text: string | null) {
  const { container } = render(
    <BookingThemeScope background={background} text={text}>
      <Probe />
    </BookingThemeScope>,
  )
  return container.firstElementChild as HTMLElement
}

describe('BookingThemeScope', () => {
  it('sets the page variables for a valid pair', () => {
    const scope = renderScope('#0B1F3A', '#F5F7FA')

    expect(scope).toHaveAttribute('data-booking-theme', 'custom')
    expect(scope.style.getPropertyValue('--page-bg')).toBe('#0b1f3a')
    expect(scope.style.getPropertyValue('--page-fg')).toBe('#f5f7fa')
    expect(scope.style.getPropertyValue('--page-muted')).toMatch(/^#[0-9a-f]{6}$/)
    expect(screen.getByText('themed')).toBeInTheDocument()
  })

  it('leaves the default look untouched when unset', () => {
    const scope = renderScope(null, null)

    expect(scope).toHaveAttribute('data-booking-theme', 'default')
    expect(scope).not.toHaveAttribute('style')
    expect(scope).toHaveClass('bg-page', 'text-page-fg')
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it.each([
    ['an invalid hex', '#fff', '#000000'],
    ['CSS that is not a colour', '#000000;background:url(x)', '#ffffff'],
    ['half a pair', '#000000', null],
    ['a pair that fails contrast', '#ffffff', '#eeeeee'],
  ])('falls back to the default on %s', (_, bg, fg) => {
    const scope = renderScope(bg, fg)

    expect(scope).toHaveAttribute('data-booking-theme', 'default')
    expect(scope).not.toHaveAttribute('style')
  })
})
