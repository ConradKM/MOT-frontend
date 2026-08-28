import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as garageApi from './garage'
import * as customersApi from './customers'
import * as vehiclesApi from './vehicles'
import * as motRecordsApi from './motRecords'
import * as appointmentsApi from './appointments'
import type { CustomerInput } from './customers'
import type { VehicleInput, VehicleListParams } from './vehicles'
import type { MOTRecordInput } from './motRecords'
import type { AppointmentInput, AppointmentListParams } from './appointments'

// Garage
export function useGarage() {
  return useQuery({ queryKey: ['garage'], queryFn: garageApi.getGarage })
}

export function useUpdateGarage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof garageApi.updateGarage>[0]) =>
      garageApi.updateGarage(data),
    onSuccess: (garage) => qc.setQueryData(['garage'], garage),
  })
}

// Customers
export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', { search }],
    queryFn: () => customersApi.listCustomers({ search }),
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.getCustomer(id as string),
    enabled: id !== undefined,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CustomerInput) => customersApi.createCustomer(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CustomerInput>) => customersApi.updateCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

// Vehicles
export function useVehicles(params: VehicleListParams = {}) {
  return useQuery({
    queryKey: ['vehicles', params],
    queryFn: () => vehiclesApi.listVehicles(params),
  })
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => vehiclesApi.getVehicle(id as string),
    enabled: id !== undefined,
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VehicleInput) => vehiclesApi.createVehicle(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<VehicleInput>) => vehiclesApi.updateVehicle(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.deleteVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

// MOT records
export function useMOTRecords(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['motRecords', vehicleId],
    queryFn: () => motRecordsApi.listMOTRecords(vehicleId as string),
    enabled: vehicleId !== undefined,
  })
}

export function useCreateMOTRecord(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MOTRecordInput) => motRecordsApi.createMOTRecord(vehicleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['motRecords', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

export function useUpdateMOTRecord(vehicleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MOTRecordInput> }) =>
      motRecordsApi.updateMOTRecord(vehicleId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['motRecords', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// Appointments
export function useAppointments(params: AppointmentListParams = {}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => appointmentsApi.listAppointments(params),
  })
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AppointmentInput) => appointmentsApi.createAppointment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AppointmentInput>) => appointmentsApi.updateAppointment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useCancelAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appointmentsApi.cancelAppointment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })
}
