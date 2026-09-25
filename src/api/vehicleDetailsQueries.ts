import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as vehicleDetailsApi from './vehicleDetails'

/** React Query hooks for ./vehicleDetails.ts - kept out of the shared queries.ts so this
 * feature stays in files of its own; the API module stays mockable in tests. */

export function useVehicleDetails() {
  return useQuery({ queryKey: ['vehicleDetails'], queryFn: vehicleDetailsApi.getVehicleDetails })
}

export function useUpdateVehicleDetails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fields: Parameters<typeof vehicleDetailsApi.updateVehicleDetails>[0]) =>
      vehicleDetailsApi.updateVehicleDetails(fields),
    onSuccess: (data) => {
      qc.setQueryData(['vehicleDetails'], data)
      // Same configuration the section editor and the customer page show.
      qc.invalidateQueries({ queryKey: ['bookingFlowSections'] })
      qc.invalidateQueries({ queryKey: ['bookingFlow'] })
    },
  })
}
