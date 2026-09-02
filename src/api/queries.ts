import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as garageApi from './garage'
import * as publicGarageApi from './publicGarage'
import * as employeesApi from './employees'
import * as rolesApi from './roles'
import * as customersApi from './customers'
import * as vehiclesApi from './vehicles'
import * as motRecordsApi from './motRecords'
import * as appointmentsApi from './appointments'
import * as appointmentTypesApi from './appointmentTypes'
import * as checklistTemplatesApi from './checklistTemplates'
import * as appointmentChecklistsApi from './appointmentChecklists'
import * as customerAccountApi from './customerAccount'
import { getCustomerAccessToken } from './customerTokens'
import type { CustomerInput } from './customers'
import type { VehicleInput, VehicleListParams } from './vehicles'
import type { MOTRecordInput } from './motRecords'
import type { AppointmentInput, AppointmentListParams } from './appointments'
import type { AppointmentTypeStatus } from '../types'

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

// Employees
export function useEmployees() {
  return useQuery({ queryKey: ['employees'], queryFn: employeesApi.listEmployees })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof employeesApi.createEmployee>[0]) =>
      employeesApi.createEmployee(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof employeesApi.updateEmployee>[1]) =>
      employeesApi.updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

// Roles
export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: rolesApi.listRoles })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => rolesApi.createRole(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => rolesApi.updateRole(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
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

// Appointment types
export function useAppointmentTypes(status?: AppointmentTypeStatus) {
  return useQuery({
    queryKey: ['appointmentTypes', { status }],
    queryFn: () => appointmentTypesApi.listAppointmentTypes({ status }),
  })
}

export function useAppointmentType(id: string | undefined) {
  return useQuery({
    queryKey: ['appointmentTypes', id],
    queryFn: () => appointmentTypesApi.getAppointmentType(id as string),
    enabled: !!id,
  })
}

// Checklist templates (owner-facing builder, one per appointment type)
export function useChecklistTemplate(appointmentTypeId: string | undefined) {
  return useQuery({
    queryKey: ['checklistTemplate', appointmentTypeId],
    queryFn: () => checklistTemplatesApi.getChecklistTemplate(appointmentTypeId as string),
    enabled: !!appointmentTypeId,
    retry: false,
  })
}

export function useCreateChecklistTemplate(appointmentTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => checklistTemplatesApi.createChecklistTemplate(appointmentTypeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklistTemplate', appointmentTypeId] }),
  })
}

export function useDeleteChecklistTemplate(appointmentTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => checklistTemplatesApi.deleteChecklistTemplate(appointmentTypeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklistTemplate', appointmentTypeId] }),
  })
}

export function useCreateChecklistTemplateItem(appointmentTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: checklistTemplatesApi.ChecklistTemplateItemInput) =>
      checklistTemplatesApi.createChecklistTemplateItem(appointmentTypeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklistTemplate', appointmentTypeId] }),
  })
}

export function useUpdateChecklistTemplateItem(appointmentTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string
      data: Partial<checklistTemplatesApi.ChecklistTemplateItemInput>
    }) => checklistTemplatesApi.updateChecklistTemplateItem(appointmentTypeId, itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklistTemplate', appointmentTypeId] }),
  })
}

export function useDeleteChecklistTemplateItem(appointmentTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      checklistTemplatesApi.deleteChecklistTemplateItem(appointmentTypeId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklistTemplate', appointmentTypeId] }),
  })
}

// Appointment checklists (mechanic-facing logging, per appointment instance)
export function useAppointmentChecklist(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointmentChecklist', appointmentId],
    queryFn: () => appointmentChecklistsApi.getAppointmentChecklist(appointmentId as string),
    enabled: !!appointmentId,
    retry: false,
  })
}

export function useStartAppointmentChecklist(appointmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => appointmentChecklistsApi.startAppointmentChecklist(appointmentId),
    onSuccess: (checklist) =>
      qc.setQueryData(['appointmentChecklist', appointmentId], checklist),
  })
}

export function useUpdateAppointmentChecklistItem(appointmentId: string, checklistId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string
      data: Parameters<typeof appointmentChecklistsApi.updateAppointmentChecklistItem>[2]
    }) => appointmentChecklistsApi.updateAppointmentChecklistItem(checklistId, itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointmentChecklist', appointmentId] }),
  })
}

// Public garage (unauthenticated booking flow)
export function usePublicGarages(enabled = true) {
  return useQuery({
    queryKey: ['publicGarages'],
    queryFn: publicGarageApi.getPublicGarages,
    enabled,
    retry: false,
  })
}

export function usePublicGarage(id: string | undefined) {
  return useQuery({
    queryKey: ['publicGarage', id],
    queryFn: () => publicGarageApi.getPublicGarage(id as string),
    enabled: !!id,
    retry: false,
  })
}

// Customer portal (unauthenticated staff app; separate customer token)
export function useCustomerAccount() {
  return useQuery({
    queryKey: ['customerAccount'],
    queryFn: customerAccountApi.getCustomerAccount,
    enabled: !!getCustomerAccessToken(),
    retry: false,
  })
}

export function useCustomerAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ['customerAppointment', id],
    queryFn: () => customerAccountApi.getCustomerAppointment(id as string),
    enabled: !!id && !!getCustomerAccessToken(),
    retry: false,
  })
}
