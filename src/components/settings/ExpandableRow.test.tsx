import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpandableRow, ExpandToggle, SettingsTable, Th } from './ExpandableRow'
import { expectNoA11yViolations } from '../../test/a11y'

const ROWS = [
  { id: 'a', name: 'MOT test' },
  { id: 'b', name: 'Full service' },
]

function Harness() {
  const [editingId, setEditingId] = useState<string | null>(null)
  return (
    <SettingsTable
      columns={[undefined, 'w-32']}
      head={
        <tr>
          <Th>Name</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      }
    >
      {ROWS.map((r) => (
        <ExpandableRow
          key={r.id}
          colSpan={2}
          expanded={editingId === r.id}
          onClose={() => setEditingId(null)}
          label={`Edit ${r.name}`}
          summary={(toggle) => (
            <>
              <td>{r.name}</td>
              <td>
                <ExpandToggle
                  {...toggle}
                  onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                />
              </td>
            </>
          )}
        >
          <label>
            Name
            <input defaultValue={r.name} />
          </label>
          <button type="button" onClick={() => setEditingId(null)}>
            Cancel
          </button>
        </ExpandableRow>
      ))}
    </SettingsTable>
  )
}

const rowFor = (name: string) => screen.getByRole('cell', { name }).closest('tr')!
const editButton = (name: string) => within(rowFor(name)).getByRole('button')

describe('ExpandableRow', () => {
  it('keeps the summary row in place and opens the panel directly beneath it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(editButton('MOT test'))

    const summary = rowFor('MOT test')
    const panel = screen.getByRole('region', { name: 'Edit MOT test' })
    // The summary row is still there, and the panel's row is its next sibling.
    expect(summary).toBeInTheDocument()
    expect(summary.nextElementSibling).toContainElement(panel)
    expect(editButton('MOT test')).toHaveAttribute('aria-expanded', 'true')
    expect(editButton('MOT test')).toHaveAttribute('aria-controls', panel.id)
    expect(editButton('MOT test')).toHaveTextContent('Close')
  })

  it('moves focus to the first field on open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(editButton('MOT test'))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  })

  it('keeps only one row open at a time', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(editButton('MOT test'))
    await user.click(editButton('Full service'))
    expect(screen.queryByRole('region', { name: 'Edit MOT test' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Edit Full service' })).toBeInTheDocument()
    // Focus went to the newly opened panel, not back to the row that closed.
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the Edit button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(editButton('MOT test'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(editButton('MOT test')).toHaveFocus()
    expect(editButton('MOT test')).toHaveAttribute('aria-expanded', 'false')
  })

  it('returns focus to the Edit button when closed from inside (Cancel)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(editButton('Full service'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(editButton('Full service')).toHaveFocus()
  })

  it('has no detectable accessibility violations while open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(editButton('MOT test'))
    await expectNoA11yViolations(container)
  })
})
