import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicePicker } from './ServicePicker'
import { makePublicAppointmentType, makePublicAppointmentTypeGroup } from '../../test/fixtures'

const GROUPS = [
  makePublicAppointmentTypeGroup({ id: 'g1', name: 'Testing', display_mode: 'LIST' }),
  makePublicAppointmentTypeGroup({ id: 'g2', name: 'Servicing', display_mode: 'LIST', order: 1 }),
]
const SERVICES = [
  makePublicAppointmentType({ id: 'mot', name: 'MOT test', group_id: 'g1' }),
  makePublicAppointmentType({ id: 'full', name: 'Full Service', group_id: 'g2', order: 1 }),
  makePublicAppointmentType({ id: 'loose', name: 'Wash', group_id: null, order: 2 }),
]

function renderPicker(selectedId = '', onSelect = vi.fn()) {
  return render(
    <ServicePicker
      groups={GROUPS}
      services={SERVICES}
      businessDisplayMode="LIST"
      selectedId={selectedId}
      onSelect={onSelect}
    />,
  )
}

describe('ServicePicker', () => {
  it('starts every group closed, wired to the panel it controls', () => {
    renderPicker()

    for (const name of [/Testing/, /Servicing/]) {
      const header = screen.getByRole('button', { name })
      expect(header).toHaveAttribute('aria-expanded', 'false')
      expect(document.getElementById(header.getAttribute('aria-controls')!)).toHaveAttribute(
        'data-state',
        'closed',
      )
    }
    expect(screen.queryByRole('button', { name: /MOT test/ })).not.toBeInTheDocument()
    // Ungrouped services have nothing to collapse.
    expect(screen.getByRole('button', { name: /Wash/ })).toBeInTheDocument()
  })

  it('opens groups independently, not as an accordion', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: /Testing/ }))
    await user.click(screen.getByRole('button', { name: /Servicing/ }))

    expect(screen.getByRole('button', { name: /Testing/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Servicing/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /MOT test/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Full Service/ })).toBeInTheDocument()
  })

  it('keeps the group holding the selection open, with a non-colour mark', () => {
    renderPicker('full')

    expect(screen.getByRole('button', { name: /Servicing/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Testing/ })).toHaveAttribute('aria-expanded', 'false')
    const selected = screen.getByRole('button', { name: /Full Service/, pressed: true })
    expect(selected.querySelector('[data-testid="selected-mark"]')).not.toBeNull()
  })

  it('selects without anything else happening', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker('', onSelect)

    await user.click(screen.getByRole('button', { name: /Wash/ }))
    expect(onSelect).toHaveBeenCalledWith('loose')
  })
})
