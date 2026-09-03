# MOT-frontend

Automated frontend booking

Frontend for the MOT Garage backend — a multi-tenant SaaS for small MOT/garage
businesses. Talks to a Flask + PostgreSQL REST API running locally.

## Stack

- React + TypeScript, built with Vite
- Tailwind CSS
- React Router
- TanStack Query + a small typed fetch client

## Running

The backend must be running at `http://localhost:5000` (see
`MOT-backend/README.md`). This project's dev server proxies `/api` to it, so
the browser only ever talks to the Vite origin — no CORS setup needed.

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`, register a garage, and go.

## Auth

JWT access/refresh tokens, stored in `localStorage`. The API client
(`src/api/client.ts`) attaches the access token to every request, and on a
401 silently refreshes once and retries before giving up and logging out.

## Customer account hub

`/customer/login` + `/customer/account` are a second customer-facing surface
(separate from both the staff app and the public booking flow). A customer signs
in with their **email + one of their vehicle registration numbers** — no
password — and gets a customer-scoped JWT stored under its own `localStorage`
keys (`src/api/customerTokens.ts`), independent of any staff session. The hub
shows their vehicles with MOT status/history and their upcoming/past
appointments; each appointment links to a read-only detail page at
`/customer/appointments/:id`. It's backed by `GET /api/customer/account` and
`GET /api/customer/appointments/:id` (`app/customer_portal` on the backend);
`CustomerProtectedRoute` redirects to `/customer/login` when signed out.

## Known gap: staff management

There is no backend endpoint to list or create employees — the only account
that exists is whoever registered the garage (as `OWNER`). Anywhere the UI
needs to reference an employee (assigning an appointment), it takes a
free-text numeric employee ID instead of a picker, with a note explaining
why. A proper staff-management screen is blocked on a backend endpoint that
doesn't exist yet.

Similarly, there's no "who am I" endpoint, so the frontend can't tell if the
current user is `OWNER` or `STAFF` ahead of time — the Garage Settings save
button is shown to everyone, and a `STAFF` user attempting to save simply
sees the 403 surfaced as an inline message.

## Public booking

`/book` (and `/book/:garageId`) is a public, unauthenticated booking flow for
end customers, separate from the staff app. The wizard
(`src/pages/customer/BookingWizard.tsx`) picks a garage, loads its active
appointment types from `GET /api/public/<slug>`, and submits to
`POST /api/public/<slug>/booking-requests`. Submissions land as **pending
booking requests** — they don't create customers/vehicles/appointments
directly. Staff review them at `/:garageId/booking-requests`
(`src/pages/bookingRequests/`) and approve (which creates + links the real
records) or reject.

**CAPTCHA** is optional and provider-agnostic. Set `VITE_CAPTCHA_PROVIDER`
(`recaptcha` | `hcaptcha` | `turnstile`) and `VITE_CAPTCHA_SITE_KEY` (see
`.env.example`) to render the widget on the wizard; with nothing set the token
is empty and the backend's `none` provider accepts it. The backend must be
configured with the matching secret (`CAPTCHA_PROVIDER` / `CAPTCHA_SECRET`).

## Project structure

```text
src/
├── api/          typed API client, per-resource fetch functions, React Query hooks
├── auth/         auth context (login/register/logout, token state)
├── components/   shared UI (layout, toast, protected route, badges)
│   └── customer/ layout + stepper for the public booking flow
├── lib/          small helpers (JWT decode, date/time, error formatting)
├── pages/        one folder per resource (customers, vehicles, appointments, garage)
│   └── customer/ public landing page + booking wizard
└── types/        API domain types
```
