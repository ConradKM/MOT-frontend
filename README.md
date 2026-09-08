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

### Booking link & QR code

`Settings → Business Details` shows each business its **public booking link** and
a **QR code**, with copy / download PNG / download SVG (`BookingQrCard`). The
link is `${VITE_BOOKING_BASE_URL ?? 'https://app.comaz.co.uk'}/book/<business
UUID>` — the same `/book/:garageId` route the wizard uses. The QR is generated
in the browser from that string (`qrcode` package); nothing is stored.

Because the link encodes the **immutable business UUID**, not the slug, QR
codes keep working across frontend deploys and are unaffected if a developer
ever re-points the (otherwise immutable) slug. Only hand-written `/book/<slug>`
links would break in that case — the printed QR would not.

## Deployment

The production site is a static Vite build (Cloudflare Pages). There is no dev
proxy in a static build, so the bundle needs the backend's absolute origin at
build time via `VITE_API_BASE_URL` (`src/api/config.ts`); leave it unset for
local dev, where Vite proxies `/api` instead.

```bash
VITE_API_BASE_URL=https://mot-backend.onrender.com
```

Set it as a build/environment variable in the Cloudflare Pages project. A build
variable is only baked in on the next build, so a change to it takes effect
after the following push to `main`.

## Testing

The frontend test suite is self-contained: every network call is mocked, so
nothing here needs the Flask backend or PostgreSQL running.

```bash
npm run test              # all unit + component + integration tests (Vitest)
npm run test:watch        # the same, in watch mode
npm run test:unit         # lib / api / hooks / auth only
npm run test:components   # shared components only
npm run test:integration  # pages + whole-app routing only
npm run test:coverage     # all of the above, with a coverage report
npm run test:e2e          # Playwright, against a real production build
npm run test:e2e:ui       # Playwright's interactive runner
npm run lint              # oxlint
npm run typecheck         # tsc -b
npm run build             # production build
```

Run exactly what CI runs, in the same order, with one command:

```bash
npm run ci
```

First-time E2E setup needs the browser downloaded once:

```bash
npx playwright install chromium
```

- **Vitest + Testing Library** cover units, components and integration. The
  network is mocked with **MSW** (`src/test/msw/`), so integration tests
  exercise the real `apiFetch` client — auth headers, the 401→refresh→retry
  path and `ApiError` parsing included. Accessibility is asserted with
  **axe-core** via `src/test/a11y.ts`.
- **Playwright** covers the highest-value journeys in real Chromium against the
  production bundle (`vite preview`), with every `/api/**` call intercepted by
  `e2e/fixtures/api.ts`. This is also where responsive behaviour and colour
  contrast are checked, since jsdom applies no CSS.

`docs/TESTING.md` records the strategy, the measured coverage, what is still
untested, and the defects this work uncovered.

## CI

`.github/workflows/frontend-ci.yml` runs on every pull request targeting `main`
(and on pushes to `main`). It lints, type-checks, runs the full Vitest suite
with coverage, builds the production frontend and runs the Playwright suite.
The pipeline never contacts a real backend or database.

The workflow ends in a single `Frontend CI` job that fails if any earlier job
did — that is the required status check on `main`, and it keeps covering new
jobs added later without reconfiguration.

### Every PR needs a related issue

`.github/workflows/pr-linked-issue.yml` runs a second required check,
**`Related issue`**, on every pull request into `main`. It passes when the PR
is connected to an issue in either of the ways the team already works:

- a **linked** issue — anything showing in the PR's *Development* sidebar,
  which includes closing keywords in the description (`Closes #123`) and
  issues linked by hand; or
- a **referenced** issue — `Refs #123`, `Related to owner/repo#123`, or a full
  issue URL — for work that relates to an issue without closing it.

A reference only counts if the issue really exists and is an issue rather than
a pull request, so a stray `#123456` (a hex colour, say) will not satisfy it.
Editing the PR description re-runs the check, so adding the reference clears
it without needing another push.

If no issue covers the work yet, open one first — the point of the check is
that every change on `main` is traceable to a reason.

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
├── test/         test setup, fixtures, MSW handlers, a11y helper
└── types/        API domain types

e2e/              Playwright specs + their API stub fixtures
docs/TESTING.md   test strategy, coverage, known gaps
```
