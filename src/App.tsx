import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { CustomersList } from './pages/customers/CustomersList'
import { CustomerForm } from './pages/customers/CustomerForm'
import { CustomerDetail } from './pages/customers/CustomerDetail'
import { VehiclesList } from './pages/vehicles/VehiclesList'
import { VehicleForm } from './pages/vehicles/VehicleForm'
import { VehicleDetail } from './pages/vehicles/VehicleDetail'
import { AppointmentsCalendar } from './pages/appointments/AppointmentsCalendar'
import { AppointmentForm } from './pages/appointments/AppointmentForm'
import { AppointmentOverview } from './pages/appointments/AppointmentOverview'
import { AppointmentChecklistPage } from './pages/appointments/AppointmentChecklistPage'
import { EmployeesList } from './pages/employees/EmployeesList'
import { RolesList } from './pages/roles/RolesList'
import { AppointmentTypesList } from './pages/appointmentTypes/AppointmentTypesList'
import { ChecklistTemplateBuilder } from './pages/appointmentTypes/ChecklistTemplateBuilder'
import { ChecklistTemplateViewer } from './pages/appointmentTypes/ChecklistTemplateViewer'
import { SettingsHub } from './pages/settings/SettingsHub'
import { AvailabilitySettings } from './pages/settings/AvailabilitySettings'
import { MotReminderSettings } from './pages/settings/MotReminderSettings'
import { GarageDetails } from './pages/settings/GarageDetails'
import { BookingRequestsList } from './pages/bookingRequests/BookingRequestsList'
import { MotRemindersList } from './pages/motReminders/MotRemindersList'
import { AppointmentStatusesList } from './pages/appointmentStatuses/AppointmentStatusesList'
import { CustomerLayout } from './components/customer/CustomerLayout'
import { CustomerProtectedRoute } from './components/CustomerProtectedRoute'
import { BookingWizard } from './pages/customer/BookingWizard'
import { CustomerLogin } from './pages/customer/CustomerLogin'
import { CustomerAccount } from './pages/customer/CustomerAccount'
import { CustomerAppointmentDetail } from './pages/customer/CustomerAppointmentDetail'
import { Dashboard, DashboardRedirect } from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Onboarding only — not linked from Login; garage users can't self-register. */}
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<CustomerLayout />}>
        {/* Customer booking is always entered via a garage-specific URL
            (/book/<garage id>). There is no generic landing or garage picker. */}
        <Route path="/" element={<Navigate to="/book" replace />} />
        <Route path="/book" element={<BookingWizard />} />
        <Route path="/book/:garageId" element={<BookingWizard />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route element={<CustomerProtectedRoute />}>
          <Route path="/customer/account" element={<CustomerAccount />} />
          <Route
            path="/customer/appointments/:appointmentId"
            element={<CustomerAppointmentDetail />}
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardRedirect />} />

        <Route path="/:garageId" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="customers" element={<CustomersList />} />
          <Route path="customers/new" element={<CustomerForm />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />

          <Route path="vehicles" element={<VehiclesList />} />
          <Route path="vehicles/new" element={<VehicleForm />} />
          <Route path="vehicles/:id" element={<VehicleDetail />} />
          <Route path="vehicles/:id/edit" element={<VehicleForm />} />

          <Route path="booking-requests" element={<BookingRequestsList />} />
          <Route path="mot-reminders" element={<MotRemindersList />} />

          <Route path="appointments" element={<AppointmentsCalendar />} />
          <Route path="appointments/new" element={<AppointmentForm />} />
          <Route path="appointments/:id/edit" element={<AppointmentForm />} />
          <Route path="appointments/:appointmentId/overview" element={<AppointmentOverview />} />
          <Route path="appointments/:appointmentId/checklist" element={<AppointmentChecklistPage />} />

          <Route
            path="appointment-types/:appointmentTypeId/checklist"
            element={<ChecklistTemplateViewer />}
          />
          <Route
            path="appointment-types/:appointmentTypeId/checklist/build"
            element={<ChecklistTemplateBuilder />}
          />

          <Route path="settings" element={<SettingsHub />} />
          <Route path="settings/garage-details" element={<GarageDetails />} />
          <Route path="settings/mot-reminders" element={<MotReminderSettings />} />
          <Route path="settings/employees" element={<EmployeesList />} />
          <Route path="settings/roles" element={<RolesList />} />
          <Route path="settings/appointment-types" element={<AppointmentTypesList />} />
          <Route path="settings/appointment-statuses" element={<AppointmentStatusesList />} />
          <Route path="settings/availability" element={<AvailabilitySettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/book" replace />} />
    </Routes>
  )
}
