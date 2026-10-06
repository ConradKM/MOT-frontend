import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddOnPicker } from './AddOnPicker'
import type { AddOnOption, AddOnSelection } from '../../lib/addOns'

const opt = (patch: Partial<AddOnOption>): AddOnOption => ({
  id: 'x',
  name: 'X',
  description: null,
  price_delta: '0.00',
  duration_delta_minutes: 0,
  max_quantity: 1,
  exclusivity_group: null,
  ...patch,
})

const ADD_ONS = [
  opt({ id: 'tyre', name: 'Tyre check', price_delta: '15.00', duration_delta_minutes: 30 }),
  opt({ id: 'key', name: 'Key cut', price_delta: '4.00', duration_delta_minutes: 5, max_quantity: 3 }),
  opt({ id: 'std', name: 'Standard', exclusivity_group: 'Turnaround' }),
  opt({ id: 'rush', name: 'Rush job', price_delta: '25.00', duration_delta_minutes: -20, exclusivity_group: 'Turnaround' }),
]

/** Controlled like the real forms, with the running selection exposed. */
function Harness({ initial = {} }: { initial?: AddOnSelection }) {
  const [value, setValue] = useState<AddOnSelection>(initial)
  return (
    <>
      <label htmlFor="picker">Add-ons</label>
      <AddOnPicker id="picker" addOns={ADD_ONS} value={value} onChange={setValue} />
      <output data-testid="selection">{JSON.stringify(value)}</output>
    </>
  )
}

const selection = () => JSON.parse(screen.getByTestId('selection').textContent ?? '{}')
const trigger = () => screen.getByRole('button', { name: /Add-ons/ })

describe('AddOnPicker', () => {
  it('opens and closes with a transition rather than mounting/unmounting', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Closed: in the DOM (so it can animate out) but hidden from AT and inert.
    const panel = screen.getByRole('dialog', { hidden: true })
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveClass('transition', 'opacity-0', 'scale-95', 'invisible')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger())
    expect(screen.getByRole('dialog', { name: 'Add-ons' })).toHaveClass('opacity-100', 'scale-100')
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(trigger()).toHaveFocus()
  })

  it('toggles a single-pick add-on and shows its delta', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())

    expect(screen.getByText('+30 min · +£15.00')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Tyre check/ }))
    expect(selection()).toEqual({ tyre: 1 })

    await user.click(screen.getByRole('checkbox', { name: /Tyre check/ }))
    expect(selection()).toEqual({})
  })

  it('keeps at most one add-on per exclusivity group, and lets it be cleared', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ tyre: 1 }} />)
    await user.click(trigger())

    await user.click(screen.getByRole('radio', { name: /Standard/ }))
    expect(selection()).toEqual({ tyre: 1, std: 1 })

    await user.click(screen.getByRole('radio', { name: /Rush job/ }))
    expect(selection()).toEqual({ tyre: 1, rush: 1 })
    expect(screen.getByRole('radio', { name: /Standard/ })).not.toBeChecked()

    await user.click(screen.getByRole('radio', { name: /Rush job/ }))
    expect(selection()).toEqual({ tyre: 1 })
  })

  it('steps quantity within 0..max for a multi-quantity add-on', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())

    const add = screen.getByRole('button', { name: 'Add one Key cut' })
    const remove = screen.getByRole('button', { name: 'Remove one Key cut' })
    expect(remove).toBeDisabled()

    await user.click(add)
    await user.click(add)
    await user.click(add)
    expect(selection()).toEqual({ key: 3 })
    expect(add).toBeDisabled()

    await user.click(remove)
    expect(selection()).toEqual({ key: 2 })
  })

  it('summarises the selection and its combined effect on the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())
    await user.click(screen.getByRole('checkbox', { name: /Tyre check/ }))
    await user.click(screen.getByRole('button', { name: 'Add one Key cut' }))
    await user.click(screen.getByRole('button', { name: 'Add one Key cut' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // 30 + 2×5 min, £15 + 2×£4
    expect(trigger()).toHaveTextContent('Tyre check, 2× Key cut')
    expect(trigger()).toHaveTextContent('+40 min · +£23.00')
  })

  it('is disabled with an explanation when the service has no add-ons', () => {
    render(<AddOnPicker id="p" addOns={[]} value={{}} onChange={() => {}} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('No extras offered for this service')
  })
})
