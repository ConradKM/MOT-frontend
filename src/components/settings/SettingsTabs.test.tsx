import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { SettingsTabs, useTabParam } from './SettingsTabs'

const TABS = [
  { key: 'one', label: 'First' },
  { key: 'two', label: 'Second' },
  { key: 'three', label: 'Third' },
] as const

function Harness() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.key))
  const location = useLocation()
  return (
    <>
      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} label="Example">
        <p>Panel {tab}</p>
      </SettingsTabs>
      <output data-testid="search">{location.search}</output>
    </>
  )
}

const renderAt = (url = '/settings') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Harness />
    </MemoryRouter>,
  )

describe('SettingsTabs', () => {
  it('defaults to the first tab, with a roving tabindex', () => {
    renderAt()
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'First' })).toHaveTextContent('Panel one')
  })

  it('opens the tab named in ?tab=, so a tab can be deep-linked', () => {
    renderAt('/settings?tab=three')
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel three')
  })

  it('falls back to the first tab for an unknown ?tab= value', () => {
    renderAt('/settings?tab=nope')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
  })

  it('writes the chosen tab to the URL', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('tab', { name: 'Second' }))
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=two')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel two')
  })

  it('moves between tabs with the arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    renderAt()
    screen.getByRole('tab', { name: 'First' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus()

    // Wraps around from the last tab to the first.
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus()
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=one')
  })
})
