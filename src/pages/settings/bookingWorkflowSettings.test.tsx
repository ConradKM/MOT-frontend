import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWorkflowSettings } from './BookingWorkflowSettings'
import { ApiError } from '../../api/client'
import * as groupsApi from '../../api/appointmentTypeGroups'
import * as bookingFlowApi from '../../api/bookingFlow'
import * as appointmentTypesApi from '../../api/appointmentTypes'
import {
  makeAppointmentType,
  makeAppointmentTypeGroup,
  makeFlowField,
  makeFlowSection,
} from '../../test/fixtures'

vi.mock('../../api/appointmentTypeGroups')
vi.mock('../../api/bookingFlow')
vi.mock('../../api/appointmentTypes')

function render() {
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/booking-workflow" element={<BookingWorkflowSettings />} />
    </Routes>,
    { route: '/g1/settings/booking-workflow' },
  )
}

beforeEach(() => {
  vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([])
  vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([])
  vi.mocked(bookingFlowApi.listBookingFlowPresets).mockResolvedValue({ presets: [] })
  vi.mocked(appointmentTypesApi.listAppointmentTypes).mockResolvedValue([makeAppointmentType()])
})

afterEach(() => vi.clearAllMocks())

describe('Booking Workflow settings — services & groups', () => {
  it('says a flat list is fine when there are no groups', async () => {
    render()

    expect(await screen.findByText(/No groups yet/)).toBeInTheDocument()
  })

  it('creates a group with the next order, so it lands at the end', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    vi.mocked(groupsApi.createAppointmentTypeGroup).mockResolvedValue(
      makeAppointmentTypeGroup({ id: 'grp2', name: 'Repairs', order: 1 }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /Add a group/ }))
    await user.type(screen.getByLabelText('Group name'), 'Repairs')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(groupsApi.createAppointmentTypeGroup).toHaveBeenCalledWith({
        name: 'Repairs',
        order: 1,
      }),
    )
  })

  it('sends a null display mode when a group has no preference of its own', async () => {
    // Null means "inherit the business default", so changing that default
    // later still moves this group. Storing a copy would strand it.
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ display_mode: 'GRID' }),
    ])
    vi.mocked(groupsApi.updateAppointmentTypeGroup).mockResolvedValue(
      makeAppointmentTypeGroup({ display_mode: null }),
    )
    const user = userEvent.setup()
    render()

    await user.selectOptions(
      await screen.findByLabelText('Show as'),
      'Same as the rest of the business',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(groupsApi.updateAppointmentTypeGroup).toHaveBeenCalledWith(
        'grp1',
        expect.objectContaining({ display_mode: null }),
      ),
    )
  })

  it('reorders by sending the whole list, not one move', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'a', name: 'A', order: 0 }),
      makeAppointmentTypeGroup({ id: 'b', name: 'B', order: 1 }),
    ])
    vi.mocked(groupsApi.reorderAppointmentTypeGroups).mockResolvedValue([])
    const user = userEvent.setup()
    render()

    const moveDown = await screen.findAllByRole('button', { name: 'Move down' })
    await user.click(moveDown[0])

    await waitFor(() =>
      expect(groupsApi.reorderAppointmentTypeGroups).toHaveBeenCalledWith(['b', 'a']),
    )
  })

  it('warns that an empty group is hidden from customers', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup(),
    ])
    render()

    expect(await screen.findByText(/stays hidden from customers/)).toBeInTheDocument()
  })

  it('says removing a group keeps its services', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup(),
    ])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Remove group' }))

    expect(screen.getByText('Remove this group?')).toBeInTheDocument()
  })
})

describe('Booking Workflow settings — what you ask', () => {
  const SECTION = makeFlowSection({
    id: 'sec1',
    title: 'About your visit',
    fields: [makeFlowField({ id: 'fld1', label: 'Hair length' })],
  })

  it('explains that name and contact details are always asked', async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))

    expect(screen.getByText(/name, email and mobile number/)).toBeInTheDocument()
  })

  it('offers a template only while the business asks nothing', async () => {
    vi.mocked(bookingFlowApi.listBookingFlowPresets).mockResolvedValue({
      presets: [{ key: 'appointments', sections: ['About your appointment'] }],
    })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))

    expect(await screen.findByText(/Start from a template/)).toBeInTheDocument()
  })

  it('hides the template offer once a section exists', async () => {
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([SECTION])
    vi.mocked(bookingFlowApi.listBookingFlowPresets).mockResolvedValue({
      presets: [{ key: 'appointments', sections: ['About your appointment'] }],
    })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await screen.findByDisplayValue('About your visit')

    expect(screen.queryByText(/Start from a template/)).not.toBeInTheDocument()
  })

  it('warns that a per-service override replaces the default rather than adding to it', async () => {
    // The one rule about this model that can surprise a business.
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.selectOptions(screen.getByLabelText('Editing'), 'Only when booking: MOT test')

    // "instead, not as well" is the whole warning - a regex for /not/ alone
    // would pass on almost any copy.
    expect(
      screen.getByText(/will use these instead/).textContent?.replace(/\s+/g, ' '),
    ).toMatch(/use these instead — not as well/)
  })

  it('scopes a new section to the service being edited', async () => {
    vi.mocked(bookingFlowApi.createBookingFlowSection).mockResolvedValue(SECTION)
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.selectOptions(screen.getByLabelText('Editing'), 'Only when booking: MOT test')
    await user.click(screen.getByRole('button', { name: /Add a section/ }))
    await user.type(screen.getByLabelText('Section heading'), 'Just for MOTs')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(bookingFlowApi.createBookingFlowSection).toHaveBeenCalledWith({
        title: 'Just for MOTs',
        order: 0,
        appointment_type_id: 'at1',
      }),
    )
  })

  it('warns about the conversational channel next to the required toggle', async () => {
    // A business marking a field required should learn here that WhatsApp and
    // phone bookings cannot ask it, not from a half-empty review screen.
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([SECTION])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.click(await screen.findByLabelText('Must be answered'))

    expect(screen.getByText(/WhatsApp or the phone can't ask this/)).toBeInTheDocument()
  })

  it('will not save a choose-one question with no choices', async () => {
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([SECTION])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.selectOptions(await screen.findByLabelText('Answer type'), 'Choose one')

    expect(screen.getByText(/nothing for the customer to pick/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save question' })).toBeDisabled()
  })

  it('blocks a numeric binding on a non-numeric question', async () => {
    // The server refuses it, because the binding writes into a real integer
    // column - better to say so before they press save.
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([SECTION])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.selectOptions(
      await screen.findByLabelText(/Also save this answer/),
      "The item's year",
    )

    expect(screen.getByText(/only works on a Number question/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save question' })).toBeDisabled()
  })

  it('sends a null binding when the question just keeps its answer', async () => {
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([
      makeFlowSection({
        ...SECTION,
        fields: [makeFlowField({ id: 'fld1', label: 'Reg', binds_to: 'ITEM_REFERENCE' })],
      }),
    ])
    vi.mocked(bookingFlowApi.updateBookingFlowField).mockResolvedValue(makeFlowField())
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.selectOptions(
      await screen.findByLabelText(/Also save this answer/),
      'Just keep the answer',
    )
    await user.click(screen.getByRole('button', { name: 'Save question' }))

    await waitFor(() =>
      expect(bookingFlowApi.updateBookingFlowField).toHaveBeenCalledWith(
        'fld1',
        expect.objectContaining({ binds_to: null }),
      ),
    )
  })

  it('says deleting a section leaves past answers alone', async () => {
    vi.mocked(bookingFlowApi.listBookingFlowSections).mockResolvedValue([SECTION])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'What you ask' }))
    await user.click(await screen.findByRole('button', { name: 'Delete section' }))

    expect(screen.getByText(/Delete this section and its questions\?/)).toBeInTheDocument()
  })
})

describe('Booking Workflow settings — share links', () => {
  it('gives a link per service and per group', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Share links' }))

    expect(screen.getByText(/\?service=at1$/)).toBeInTheDocument()
    expect(screen.getByText(/\?group=grp1$/)).toBeInTheDocument()
  })

  it('says a one-service group skips straight to the calendar', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    vi.mocked(appointmentTypesApi.listAppointmentTypes).mockResolvedValue([
      makeAppointmentType({ id: 'at1', group_id: 'grp1' }),
    ])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Share links' }))

    expect(screen.getByText(/Only one service in this group/)).toBeInTheDocument()
  })
})

describe('Booking Workflow settings — permissions', () => {
  it('tells a non-owner that only an owner can change this', async () => {
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockRejectedValue(
      new ApiError({ code: 403, status: 'Forbidden', message: 'Owner only' }, 'x'),
    )
    render()

    expect(await screen.findByText(/Only an owner can change/)).toBeInTheDocument()
  })
})

describe('Appointment types list', () => {
  it('shows which group each service is in', async () => {
    const { AppointmentTypesList } = await import('../appointmentTypes/AppointmentTypesList')
    vi.mocked(groupsApi.listAppointmentTypeGroups).mockResolvedValue([
      makeAppointmentTypeGroup({ id: 'grp1', name: 'Servicing' }),
    ])
    vi.mocked(appointmentTypesApi.listAppointmentTypes).mockResolvedValue([
      makeAppointmentType({ id: 'at1', name: 'MOT test', group_id: 'grp1' }),
      makeAppointmentType({ id: 'at2', name: 'Valet', group_id: null }),
    ])

    renderWithAppProviders(
      <Routes>
        <Route path="/:garageId/settings/appointment-types" element={<AppointmentTypesList />} />
      </Routes>,
      { route: '/g1/settings/appointment-types' },
    )

    const mot = (await screen.findByText('MOT test')).closest('tr')!
    const valet = screen.getByText('Valet').closest('tr')!
    expect(within(mot).getByText('Servicing')).toBeInTheDocument()
    expect(within(valet).getByText('Ungrouped')).toBeInTheDocument()
  })
})
