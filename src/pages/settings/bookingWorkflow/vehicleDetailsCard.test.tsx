import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/utils'
import { ToastProvider } from '../../../components/Toast'
import { VehicleDetailsCard } from './VehicleDetailsCard'
import * as vehicleDetailsApi from '../../../api/vehicleDetails'

vi.mock('../../../api/vehicleDetails')

const OFF: vehicleDetailsApi.VehicleDetails = {
  fields: {
    registration: { enabled: false, required: false },
    make: { enabled: false, required: false },
    model: { enabled: false, required: false },
  },
  services_with_own_workflow: 0,
}

function render(details: vehicleDetailsApi.VehicleDetails = OFF) {
  vi.mocked(vehicleDetailsApi.getVehicleDetails).mockResolvedValue(details)
  return renderWithProviders(
    <ToastProvider>
      <VehicleDetailsCard />
    </ToastProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

/** The card is a read-only summary until Edit is pressed. */
async function openEditor(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  return user
}

describe('VehicleDetailsCard', () => {
  it('is off by default - a business is never asked for vehicle details it did not turn on', async () => {
    render()
    expect(await screen.findByTestId('vehicle-details-summary')).toHaveTextContent('Not asked.')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await openEditor()
    expect(
      await screen.findByRole('checkbox', { name: /ask for registration number/i }),
    ).not.toBeChecked()
    expect(screen.getByRole('button', { name: /save vehicle details/i })).toBeDisabled()
  })

  it('enables registration, make and model for the business', async () => {
    vi.mocked(vehicleDetailsApi.updateVehicleDetails).mockResolvedValue(OFF)
    render()
    const user = await openEditor()

    await user.click(await screen.findByRole('checkbox', { name: /ask for registration number/i }))
    await user.click(screen.getByRole('checkbox', { name: 'Registration number required' }))
    await user.click(screen.getByRole('checkbox', { name: /ask for make/i }))
    await user.click(screen.getByRole('checkbox', { name: /ask for model/i }))
    await user.click(screen.getByRole('button', { name: /save vehicle details/i }))

    await waitFor(() =>
      expect(vehicleDetailsApi.updateVehicleDetails).toHaveBeenCalledWith({
        registration: { enabled: true, required: true },
        make: { enabled: true, required: false },
        model: { enabled: true, required: false },
      }),
    )
  })

  it('turning on make also turns on the registration it is saved against', async () => {
    render()
    const user = await openEditor()
    await user.click(await screen.findByRole('checkbox', { name: /ask for make/i }))
    expect(screen.getByRole('checkbox', { name: /ask for registration number/i })).toBeChecked()
  })

  it('warns when some services have their own questions', async () => {
    render({ ...OFF, services_with_own_workflow: 2 })
    expect(await screen.findByText(/2 services have their own questions/i)).toBeInTheDocument()
  })

  it('summarises what is asked, and Cancel throws away unsaved changes', async () => {
    render({
      ...OFF,
      fields: {
        registration: { enabled: true, required: true },
        make: { enabled: true, required: false },
        model: { enabled: false, required: false },
      },
    })
    expect(await screen.findByTestId('vehicle-details-summary')).toHaveTextContent(
      'Asks for registration number (required), make.',
    )
    const user = await openEditor()
    expect(screen.getByRole('checkbox', { name: /ask for registration number/i })).toHaveFocus()
    await user.click(screen.getByRole('checkbox', { name: /ask for model/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    await openEditor(user)
    expect(screen.getByRole('checkbox', { name: /ask for model/i })).not.toBeChecked()
  })
})
