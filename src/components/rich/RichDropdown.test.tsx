import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RichDropdown, type RichDropdownOption } from './RichDropdown'
import { expectNoA11yViolations } from '../../test/a11y'

const OPTIONS: RichDropdownOption[] = [
  { value: 'at1', title: 'MOT test', description: '£54.85 · 60 min' },
  { value: 'at2', title: 'Full service', description: '£180.00 · 180 min' },
  { value: 'at3', title: 'Brake check' },
]

function renderDropdown(props: Partial<React.ComponentProps<typeof RichDropdown>> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <RichDropdown options={OPTIONS} value="" onChange={onChange} {...props} />,
  )
  return { onChange, ...utils }
}

const trigger = () => screen.getByRole('combobox')

describe('RichDropdown — rendering', () => {
  it('shows a placeholder while nothing is selected', () => {
    renderDropdown({ placeholder: 'Choose a service…' })
    expect(trigger()).toHaveTextContent('Choose a service…')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the selected option’s title and its description line', () => {
    renderDropdown({ value: 'at1' })
    expect(trigger()).toHaveTextContent('MOT test')
    expect(trigger()).toHaveTextContent('£54.85 · 60 min')
  })

  it('keeps the list closed until asked', () => {
    renderDropdown()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('RichDropdown — pointer interaction', () => {
  it('opens the list and marks the current selection', async () => {
    const user = userEvent.setup()
    renderDropdown({ value: 'at2' })
    await user.click(trigger())

    const listbox = screen.getByRole('listbox')
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
    expect(within(listbox).getByRole('option', { name: /full service/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('reports the chosen value and closes', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    await user.click(trigger())
    await user.click(screen.getByRole('option', { name: /brake check/i }))

    expect(onChange).toHaveBeenCalledWith('at3')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes again when the trigger is clicked a second time', async () => {
    const user = userEvent.setup()
    renderDropdown()
    await user.click(trigger())
    await user.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes when the user clicks away without choosing', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    render(<button>elsewhere</button>)
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cannot be opened when disabled', async () => {
    const user = userEvent.setup()
    renderDropdown({ disabled: true })
    expect(trigger()).toBeDisabled()
    await user.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not open an empty option list', async () => {
    // Opening onto an empty panel is a dead end — better to stay shut.
    const user = userEvent.setup()
    renderDropdown({ options: [] })
    await user.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('RichDropdown — keyboard interaction', () => {
  it('opens on ArrowDown from the trigger', async () => {
    const user = userEvent.setup()
    renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('opens on Enter and on Space', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDropdown()
    trigger().focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    unmount()

    renderDropdown()
    trigger().focus()
    await user.keyboard(' ')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('moves the active option with the arrow keys and selects it with Enter', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')
    // down-to-open, then 0 → 1 → 2 → back to 1 = "Full service".
    expect(onChange).toHaveBeenCalledWith('at2')
  })

  it('starts navigation from the current selection, not the top of the list', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown({ value: 'at2' })
    trigger().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('at3')
  })

  it('stops at the ends of the list rather than wrapping around', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{Enter}')
    expect(onChange).toHaveBeenCalledWith('at1')
  })

  it('selects the active option with Space when the trigger holds focus', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}{ArrowDown} ')
    expect(onChange).toHaveBeenCalledWith('at2')
  })

  it('abandons the list on Escape without changing the value', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes when the user tabs away', async () => {
    const user = userEvent.setup()
    renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    await user.tab()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('points assistive tech at the active option while navigating', async () => {
    const user = userEvent.setup()
    renderDropdown()
    trigger().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')

    const activeId = trigger().getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(document.getElementById(activeId as string)).toHaveTextContent('Full service')
  })
})

describe('RichDropdown — searchable mode', () => {
  const renderSearchable = () =>
    renderDropdown({ searchable: true, searchPlaceholder: 'Search services…' })

  it('focuses the filter box as soon as the list opens', async () => {
    const user = userEvent.setup()
    renderSearchable()
    await user.click(trigger())
    expect(screen.getByPlaceholderText('Search services…')).toHaveFocus()
  })

  it('narrows the list to matching titles, case-insensitively', async () => {
    const user = userEvent.setup()
    renderSearchable()
    await user.click(trigger())
    await user.type(screen.getByPlaceholderText('Search services…'), 'brake')

    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /brake check/i })).toBeInTheDocument()
  })

  it('says so when nothing matches, instead of showing a blank panel', async () => {
    const user = userEvent.setup()
    renderSearchable()
    await user.click(trigger())
    await user.type(screen.getByPlaceholderText('Search services…'), 'zzzz')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('selects the first match on Enter straight from the filter box', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown({ searchable: true })
    await user.click(trigger())
    await user.keyboard('serv{Enter}')
    expect(onChange).toHaveBeenCalledWith('at2')
  })

  it('lets a space be typed into the filter rather than selecting', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDropdown({ searchable: true, searchPlaceholder: 'Search…' })
    await user.click(trigger())
    await user.type(screen.getByPlaceholderText('Search…'), 'full serv')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('option', { name: /full service/i })).toBeInTheDocument()
  })

  it('forgets the filter text when reopened', async () => {
    const user = userEvent.setup()
    renderDropdown({ searchable: true, searchPlaceholder: 'Search…' })
    await user.click(trigger())
    await user.type(screen.getByPlaceholderText('Search…'), 'brake')
    await user.keyboard('{Escape}')
    await user.click(trigger())

    expect(screen.getByPlaceholderText('Search…')).toHaveValue('')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})

describe('RichDropdown — accessibility', () => {
  /** How every caller in the app mounts it: an associated <label> supplies the
   * accessible name, since a combobox does not take its name from its contents. */
  function renderLabelled(props: Partial<React.ComponentProps<typeof RichDropdown>> = {}) {
    return render(
      <div>
        <label htmlFor="service-picker">Service</label>
        <RichDropdown id="service-picker" options={OPTIONS} value="" onChange={vi.fn()} {...props} />
      </div>,
    )
  }

  it('takes its accessible name from the associated label', () => {
    renderLabelled({ value: 'at1' })
    expect(screen.getByRole('combobox', { name: 'Service' })).toBeInTheDocument()
  })

  it('has no detectable violations when closed', async () => {
    const { container } = renderLabelled({ value: 'at1' })
    await expectNoA11yViolations(container)
  })

  it('has no detectable violations when open', async () => {
    const user = userEvent.setup()
    const { container } = renderLabelled()
    await user.click(trigger())
    await expectNoA11yViolations(container)
  })

  it('has no detectable violations with the filter box open', async () => {
    const user = userEvent.setup()
    const { container } = renderLabelled({ searchable: true })
    await user.click(trigger())
    await expectNoA11yViolations(container)
  })
})
