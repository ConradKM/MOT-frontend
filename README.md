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

## Known gap: public booking API

`/customer` and `/customer/book` are a public, unauthenticated booking flow
for end customers (separate from the staff app — no login, different layout).
The booking wizard (`src/pages/customer/BookingWizard.tsx`) collects customer,
vehicle, and appointment details across four sections and validates them
client-side, but **it doesn't submit anywhere** — every backend endpoint that
could create a customer, vehicle, or appointment requires an authenticated
garage employee's JWT and infers the garage from it. There's no public
endpoint a logged-out customer could call, and no way to say which garage a
public booking is even for (no slug/subdomain routing exists).

The wizard's final step logs the captured payload to the console and shows a
success screen so the intended flow can be reviewed, but nothing is
persisted. Making this real needs backend work: a public booking endpoint
(likely scoped to a garage via a slug in the URL), plus a decision on whether
submissions land as pending records for staff to approve or write straight
into `customers`/`vehicles`/`appointments`.

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
