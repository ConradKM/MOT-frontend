import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { SettingsHub, SETTINGS_PAGES } from './SettingsHub'
import { SECTIONS } from '../../components/settings/SettingsLayout'

function render() {
  return renderWithProviders(
    <Routes>
      <Route path="/:garageId/settings" element={<SettingsHub />} />
    </Routes>,
    { route: '/g1/settings' },
  )
}

describe('SettingsHub', () => {
  it('has a card for every settings section', () => {
    // The hub and the side nav are two independent lists of the same pages,
    // and Booking Workflow shipped in the side nav only - reachable by URL
    // and by nothing else. This is the invariant that was missing: the hub
    // may carry extra entries, but never fewer.
    const carded = new Set(SETTINGS_PAGES.map((p) => p.slug))
    const missing = SECTIONS.filter((s) => !carded.has(`settings/${s.slug}`)).map((s) => s.label)

    expect(missing).toEqual([])
  })

  it('links each card at the garage-scoped path', async () => {
    render()

    expect(await screen.findByRole('link', { name: /Booking Workflow/ })).toHaveAttribute(
      'href',
      '/g1/settings/booking-workflow',
    )
  })

  it('finds Booking Workflow by what a business would actually search for', async () => {
    // The search box matches title + description, so the words someone types
    // looking for this - "group", "pictures", "questions" - have to be in one
    // of them.
    const user = userEvent.setup()
    render()

    for (const term of ['group', 'pictures', 'questions']) {
      await user.clear(screen.getByPlaceholderText('Search settings…'))
      await user.type(screen.getByPlaceholderText('Search settings…'), term)
      expect(
        screen.getByRole('link', { name: /Booking Workflow/ }),
        `searching "${term}" should surface Booking Workflow`,
      ).toBeInTheDocument()
    }
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText('Search settings…'), 'zzzz')

    expect(screen.getByText(/No settings pages match/)).toBeInTheDocument()
  })
})
