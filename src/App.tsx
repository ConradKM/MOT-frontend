import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { CommunicationsLayout } from './components/communications/CommunicationsLayout'
import { CustomerLayout } from './components/customer/CustomerLayout'
import { CustomerProtectedRoute } from './components/CustomerProtectedRoute'
import { RemindersLayout } from './pages/reminders/RemindersLayout'

// Every leaf page is loaded on demand, not bundled into the initial JS chunk.
// Without this, opening any one page - even a plain settings screen - pulled
// in every page in the app plus every heavy third-party SDK they use
// (@twilio/voice-sdk, @stripe/stripe-js) in one ~850kB chunk, all parsed and
// held in memory for the life of the tab. Only the route shells above
// (layouts/guards - small, always needed the moment you're in their section)
// stay as regular imports.
const SignIn = lazy(() => import('./pages/SignIn').then((m) => ({ default: m.SignIn })))
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })))
const ForgotPassword = lazy(() =>
  import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
)
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const ImpersonationHandoff = lazy(() =>
  import('./pages/ImpersonationHandoff').then((m) => ({ default: m.ImpersonationHandoff })),
)

const CustomersList = lazy(() =>
  import('./pages/customers/CustomersList').then((m) => ({ default: m.CustomersList })),
)
const CustomerForm = lazy(() =>
  import('./pages/customers/CustomerForm').then((m) => ({ default: m.CustomerForm })),
)
const CustomerDetail = lazy(() =>
  import('./pages/customers/CustomerDetail').then((m) => ({ default: m.CustomerDetail })),
)

const VehiclesList = lazy(() =>
  import('./pages/vehicles/VehiclesList').then((m) => ({ default: m.VehiclesList })),
)
const VehicleForm = lazy(() =>
  import('./pages/vehicles/VehicleForm').then((m) => ({ default: m.VehicleForm })),
)
const VehicleDetail = lazy(() =>
  import('./pages/vehicles/VehicleDetail').then((m) => ({ default: m.VehicleDetail })),
)

const AppointmentsCalendar = lazy(() =>
  import('./pages/appointments/AppointmentsCalendar').then((m) => ({
    default: m.AppointmentsCalendar,
  })),
)
const AppointmentForm = lazy(() =>
  import('./pages/appointments/AppointmentForm').then((m) => ({ default: m.AppointmentForm })),
)
const AppointmentOverview = lazy(() =>
  import('./pages/appointments/AppointmentOverview').then((m) => ({
    default: m.AppointmentOverview,
  })),
)
const AppointmentChecklistPage = lazy(() =>
  import('./pages/appointments/AppointmentChecklistPage').then((m) => ({
    default: m.AppointmentChecklistPage,
  })),
)

const EmployeesList = lazy(() =>
  import('./pages/employees/EmployeesList').then((m) => ({ default: m.EmployeesList })),
)
const RolesList = lazy(() => import('./pages/roles/RolesList').then((m) => ({ default: m.RolesList })))

const AppointmentTypesList = lazy(() =>
  import('./pages/appointmentTypes/AppointmentTypesList').then((m) => ({
    default: m.AppointmentTypesList,
  })),
)
const ChecklistTemplateBuilder = lazy(() =>
  import('./pages/appointmentTypes/ChecklistTemplateBuilder').then((m) => ({
    default: m.ChecklistTemplateBuilder,
  })),
)
const ChecklistTemplateViewer = lazy(() =>
  import('./pages/appointmentTypes/ChecklistTemplateViewer').then((m) => ({
    default: m.ChecklistTemplateViewer,
  })),
)

const SettingsHub = lazy(() =>
  import('./pages/settings/SettingsHub').then((m) => ({ default: m.SettingsHub })),
)
const AvailabilitySettings = lazy(() =>
  import('./pages/settings/AvailabilitySettings').then((m) => ({
    default: m.AvailabilitySettings,
  })),
)
const BookingWorkflowSettings = lazy(() =>
  import('./pages/settings/BookingWorkflowSettings').then((m) => ({
    default: m.BookingWorkflowSettings,
  })),
)
const MotReminderSettings = lazy(() =>
  import('./pages/settings/MotReminderSettings').then((m) => ({ default: m.MotReminderSettings })),
)
const GarageDetails = lazy(() =>
  import('./pages/settings/GarageDetails').then((m) => ({ default: m.GarageDetails })),
)
const CommunicationsAutomationSettings = lazy(() =>
  import('./pages/settings/CommunicationsAutomationSettings').then((m) => ({
    default: m.CommunicationsAutomationSettings,
  })),
)
const PaymentsSettings = lazy(() =>
  import('./pages/settings/PaymentsSettings').then((m) => ({ default: m.PaymentsSettings })),
)

const BookingRequestsList = lazy(() =>
  import('./pages/bookingRequests/BookingRequestsList').then((m) => ({
    default: m.BookingRequestsList,
  })),
)
const PaymentsList = lazy(() =>
  import('./pages/payments/PaymentsList').then((m) => ({ default: m.PaymentsList })),
)
const AppointmentRemindersSettings = lazy(() =>
  import('./pages/reminders/AppointmentRemindersSettings').then((m) => ({
    default: m.AppointmentRemindersSettings,
  })),
)
const CustomerSaleReminders = lazy(() =>
  import('./pages/reminders/CustomerSaleReminders').then((m) => ({
    default: m.CustomerSaleReminders,
  })),
)
const AppointmentStatusesList = lazy(() =>
  import('./pages/appointmentStatuses/AppointmentStatusesList').then((m) => ({
    default: m.AppointmentStatusesList,
  })),
)
const FeedbackPage = lazy(() =>
  import('./pages/Feedback').then((m) => ({ default: m.FeedbackPage })),
)

const CommunicationsOverview = lazy(() =>
  import('./pages/communications/CommunicationsOverview').then((m) => ({
    default: m.CommunicationsOverview,
  })),
)
const CallsList = lazy(() =>
  import('./pages/communications/CallsList').then((m) => ({ default: m.CallsList })),
)
const WhatsAppInbox = lazy(() =>
  import('./pages/communications/WhatsAppInbox').then((m) => ({ default: m.WhatsAppInbox })),
)
const SmsInbox = lazy(() =>
  import('./pages/communications/SmsInbox').then((m) => ({ default: m.SmsInbox })),
)
const CommunicationsAttentionQueue = lazy(() =>
  import('./pages/communications/CommunicationsAttentionQueue').then((m) => ({
    default: m.CommunicationsAttentionQueue,
  })),
)
const CallbackRequestsList = lazy(() =>
  import('./pages/communications/CallbackRequestsList').then((m) => ({
    default: m.CallbackRequestsList,
  })),
)
const ConversationSimulator = lazy(() =>
  import('./pages/communications/ConversationSimulator').then((m) => ({
    default: m.ConversationSimulator,
  })),
)
// The dialler lives here - this is the chunk that carries @twilio/voice-sdk,
// so it now only loads for someone who actually opens Contact, not for every
// page in the app (see components/communications/ContactCustomer's dialler,
// which additionally only registers a Device once the Call tab is opened).
const ContactCustomer = lazy(() =>
  import('./pages/communications/ContactCustomer').then((m) => ({ default: m.ContactCustomer })),
)

// The customer-facing booking wizard - its own chunk for the same reason.
// Stripe is split further still: it only loads once the Deposit step's
// checkout actually mounts (see components/customer/payments/PaymentCheckout.tsx).
const BookingWizard = lazy(() =>
  import('./pages/customer/BookingWizard').then((m) => ({ default: m.BookingWizard })),
)
const CustomerAccount = lazy(() =>
  import('./pages/customer/CustomerAccount').then((m) => ({ default: m.CustomerAccount })),
)
const CustomerAppointmentDetail = lazy(() =>
  import('./pages/customer/CustomerAppointmentDetail').then((m) => ({
    default: m.CustomerAppointmentDetail,
  })),
)

// Walk-in queue: the public join/status pages (what the queue QR code opens)
// and the staff live queue.
const QueueJoin = lazy(() => import('./pages/queue/QueueJoin').then((m) => ({ default: m.QueueJoin })))
const QueueStatus = lazy(() =>
  import('./pages/queue/QueueStatus').then((m) => ({ default: m.QueueStatus })),
)
const QueueDashboard = lazy(() =>
  import('./pages/queue/QueueDashboard').then((m) => ({ default: m.QueueDashboard })),
)
const WalkInQueueSettings = lazy(() =>
  import('./pages/settings/WalkInQueueSettings').then((m) => ({
    default: m.WalkInQueueSettings,
  })),
)

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const DashboardRedirect = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.DashboardRedirect })),
)

/** Shown for the brief gap while a route's own chunk downloads - most routes
 * never show this at all once cached by the browser. */
function RouteFallback() {
  return <p className="p-6 text-sm text-slate-500">Loading…</p>
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Reachable at either URL - SignIn itself picks the default tab from
            the path (business at /login, customer at /customer/login), so
            existing links/redirects into either one still land correctly. */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/customer/login" element={<SignIn />} />
        {/* Onboarding only — not linked from Login; garage users can't self-register. */}
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Landing point for a CoMaz OS Platform Admin support impersonation.
            Unauthenticated by nature — the single-use code in the URL fragment
            is what it exchanges for a session. */}
        <Route path="/impersonate" element={<ImpersonationHandoff />} />

        <Route element={<CustomerLayout />}>
          {/* Customer booking is always entered via a garage-specific URL
              (/book/<garage id>). There is no generic landing or garage picker. */}
          <Route path="/" element={<Navigate to="/book" replace />} />
          <Route path="/book" element={<BookingWizard />} />
          <Route path="/book/:garageId" element={<BookingWizard />} />
          {/* Walk-in queue, entered via the business's queue link / QR code.
              No account: the status page's token is in the URL fragment. */}
          <Route path="/queue/:garageId" element={<QueueJoin />} />
          <Route path="/queue/:garageId/status" element={<QueueStatus />} />
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
            <Route path="queue" element={<QueueDashboard />} />
            <Route path="payments" element={<PaymentsList />} />
            <Route path="reminders" element={<RemindersLayout />}>
              <Route index element={<AppointmentRemindersSettings />} />
              <Route path="customer" element={<CustomerSaleReminders />} />
            </Route>
            <Route path="feedback" element={<FeedbackPage />} />

            <Route path="communications" element={<CommunicationsLayout />}>
              <Route index element={<CommunicationsOverview />} />
              <Route path="calls" element={<CallsList />} />
              <Route path="whatsapp" element={<WhatsAppInbox />} />
              <Route path="sms" element={<SmsInbox />} />
              <Route path="attention" element={<CommunicationsAttentionQueue />} />
              <Route path="callbacks" element={<CallbackRequestsList />} />
              <Route path="contact" element={<ContactCustomer />} />
              {/* Development tool only - never registered in a production build,
                  and gated again on the backend by CONVERSATION_SIMULATOR_ENABLED. */}
              {import.meta.env.DEV && <Route path="simulator" element={<ConversationSimulator />} />}
            </Route>

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
            <Route path="settings/booking-workflow" element={<BookingWorkflowSettings />} />
            <Route path="settings/appointment-statuses" element={<AppointmentStatusesList />} />
            <Route path="settings/availability" element={<AvailabilitySettings />} />
            <Route path="settings/walk-in-queue" element={<WalkInQueueSettings />} />
            <Route
              path="settings/communications-automation"
              element={<CommunicationsAutomationSettings />}
            />
            <Route path="settings/payments" element={<PaymentsSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/book" replace />} />
      </Routes>
    </Suspense>
  )
}
