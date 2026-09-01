import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { CustomersList } from './pages/customers/CustomersList'
import { CustomerForm } from './pages/customers/CustomerForm'
import { CustomerDetail } from './pages/customers/CustomerDetail'
import { VehiclesList } from './pages/vehicles/VehiclesList'
import { VehicleForm } from './pages/vehicles/VehicleForm'
import { VehicleDetail } from './pages/vehicles/VehicleDetail'
import { AppointmentsCalendar } from './pages/appointments/AppointmentsCalendar'
import { AppointmentForm } from './pages/appointments/AppointmentForm'
import { GarageSettings } from './pages/garage/GarageSettings'
import { EmployeesList } from './pages/employees/EmployeesList'
import { RolesList } from './pages/roles/RolesList'
import { SettingsHub } from './pages/settings/SettingsHub'
import { CustomerLayout } from './components/customer/CustomerLayout'
import { CustomerLanding } from './pages/customer/CustomerLanding'
import { BookingWizard } from './pages/customer/BookingWizard'
import { Dashboard, DashboardRedirect } from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<CustomerLayout />}>
        <Route path="/" element={<CustomerLanding />} />
        <Route path="/book" element={<BookingWizard />} />
        <Route path="/book/:garageId" element={<BookingWizard />} />
        <Route path="/:garageId" element={<CustomerLanding />} />
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

          <Route path="appointments" element={<AppointmentsCalendar />} />
          <Route path="appointments/new" element={<AppointmentForm />} />
          <Route path="appointments/:id/edit" element={<AppointmentForm />} />

          <Route path="settings" element={<SettingsHub />} />
          <Route path="settings/employees" element={<EmployeesList />} />
          <Route path="settings/roles" element={<RolesList />} />
          <Route path="settings/garage" element={<GarageSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
