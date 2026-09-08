# Frontend test strategy

Scope: the React frontend in this repository only. Nothing here starts, needs, or
asserts against the Flask backend or PostgreSQL — every network call is mocked.

## 1. What the application actually is

Established by reading the source, not assumed:

| Aspect | Reality |
| --- | --- |
| React | 19.2 (`StrictMode`, function components + hooks only) |
| Build tooling | Vite 8 (rolldown) + `@vitejs/plugin-react`, Tailwind CSS 4 via `@tailwindcss/vite` |
| Package manager | npm (`package-lock.json`) |
| Routing | `react-router-dom` 7, declarative `<Routes>` in `src/App.tsx`; three route trees — public/customer (`CustomerLayout`), staff (`ProtectedRoute` → `/:garageId` → `Layout`), and standalone auth pages |
| Server state | TanStack Query v5; every query/mutation is declared in `src/api/queries.ts` |
| Client state | React Context: `AuthContext` (staff), `CustomerAuthContext`, `ToastProvider`. No Redux/Zustand |
| Data layer | Hand-rolled typed `fetch` wrappers: `src/api/client.ts` (`apiFetch`) and `src/api/customerClient.ts` (`customerApiFetch`), plus one module per resource |
| Auth | JWT access/refresh in `localStorage` under separate staff (`mot_*`) and customer (`mot_customer_*`) keys; `apiFetch` silently refreshes once on a 401 and retries, else calls `onAuthFailure` |
| Forms | No form library. Hand-rolled `useState` forms, HTML5 `required`/`minLength`, plus manual validators (the booking wizard has the richest: email regex, UK-mobile regex, year/mileage bounds) |
| Error handling | `ApiError` carries `code`/`status`/`fieldErrors`; `src/lib/errors.ts` maps a 422 body to per-field messages and everything else to one form-level message |
| Responsive | Purely CSS (Tailwind `sm:`/`lg:` grid reflow). **No JS breakpoint logic** — no `matchMedia`, no mobile drawer, no conditional rendering by width |
| Accessibility | Deliberate in places: `role="dialog"`/`aria-modal`/`aria-label` on modals, a full combobox implementation in `RichDropdown`, `aria-expanded` on `Disclosure`, `aria-pressed` on the wizard's service picker, labelled inputs |
| Third-party | Optional CAPTCHA (Turnstile/reCAPTCHA/hCaptcha) loaded by `src/components/Captcha.tsx`; disabled when env vars are unset |
| Existing tests | Vitest 3 + jsdom + Testing Library; 17 files / 86 tests, all passing. Convention: module-level `vi.mock('../../api/<resource>')` |
| Lint / types | `oxlint` (`npm run lint`), `tsc -b` (part of `npm run build`) |
| CI / Docker | **None existed.** No `.github/`, no Dockerfile, no compose file |

## 2. Tooling decisions

| Need | Choice | Why |
| --- | --- | --- |
| Unit / component / integration runner | **Vitest 3 + jsdom + Testing Library** | Already in use and passing; shares the Vite transform pipeline, so no second toolchain |
| Network mocking | **MSW 2** (`src/test/msw/`) for integration + `vi.mock` for focused component tests | MSW intercepts at `fetch`, so integration tests exercise the real `apiFetch` — auth headers, the 401→refresh→retry path, `ApiError` parsing. Module mocks stay for tests that only care about one component's rendering, matching the existing convention |
| Accessibility | **`axe-core`** driven by a thin `expectNoA11yViolations` helper (`src/test/a11y.ts`) | `vitest-axe` is pinned to Vitest 0.x. Calling `axe.run` directly is stable and prints the violating nodes |
| Coverage | **`@vitest/coverage-v8`** (matched to Vitest 3.2.7) | Native V8 coverage, no instrumentation step |
| E2E | **Playwright** with `page.route('**/api/**')` fixtures | Real Chromium: real CSS (so responsive behaviour is genuinely testable), real navigation/history, real focus. Routing every API call through a fixture keeps it deterministic and backend-free |

## 3. Layers and what each one owns

```
src/lib/*.test.ts            pure logic: dates, MOT status, durations, statuses,
                             calendar layout, JWT decode, error mapping
src/api/*.test.ts            the fetch client itself, against MSW: headers, refresh,
                             status-code handling, malformed bodies
src/auth/*.test.tsx          auth contexts: token persistence, derived identity, logout
src/components/**/*.test.tsx reusable UI: modals, dialogs, toasts, disclosure, combobox,
                             layouts — interaction, keyboard, focus, a11y
src/pages/**/*.test.tsx      page-level component + integration tests: forms end-to-end,
                             list filtering, tabbed workflows, API state matrix
src/app.routing.test.tsx     whole-app routing: redirects, protected routes, 404 fallback
src/test/a11y.test.tsx       axe sweep over the highest-traffic screens
e2e/*.spec.ts                Playwright journeys against the built app with stubbed API
```

## 4. Critical user journeys (what the suite is actually protecting)

1. **Public booking** — pick date → service → time → details → review → submit; the 409
   "slot taken" recovery and the CAPTCHA gate. Highest business value: it is the only
   unauthenticated write path.
2. **Staff login → dashboard** — including the `/dashboard` → `/:garageId/dashboard`
   resolution and the redirect when a URL's garage id doesn't match the JWT's garage.
3. **Booking request triage** — approve (creates customer+vehicle+appointment) / reject,
   including the "slot may be full" conflict guard.
4. **Customer & vehicle CRUD** — the two forms staff use most, with server-side 422s.
5. **Customer portal** — email + registration sign-in, account hub, protected routes.
6. **Session expiry** — a 401 that cannot be refreshed must drop the user back to login.

## 5. API mocking strategy

- **Integration / routing / API-state tests**: an MSW `setupServer` with a default happy-path
  handler set (`src/test/msw/handlers.ts`), overridden per test with `server.use(...)` to
  produce 400/401/403/404/409/500, empty bodies, malformed JSON, slow responses and network
  failures. Because MSW sits below `apiFetch`, these tests assert what the *user* sees for
  each backend condition.
- **Focused component tests**: `vi.mock` of the specific `src/api/<resource>` module, the
  existing convention — cheaper and clearer when the test is about one component's rendering.
- **E2E**: `page.route` fixtures in `e2e/fixtures/api.ts`. No test in any layer touches a
  real host.

## 6. Responsive testing position

There is no JavaScript responsive behaviour to unit test — jsdom applies no CSS, so a
jsdom "responsive" test would assert nothing real. Responsive coverage therefore lives in
Playwright at mobile (375×812), tablet (768×1024) and desktop (1280×800) viewports, and
asserts *functional* properties: no horizontal page overflow, every primary control visible
and clickable, the booking wizard completable on a phone. No pixel snapshots.

## 7. Edge cases explicitly covered

Empty lists and per-tab empty states · no search results · null/absent optional fields
(`make`, `model`, `mot_expiry_date`, `phone`) · unknown/foreign ids rendering a placeholder
rather than crashing · MOT expiry boundary (today / +29 days / +31 days) · year and mileage
bounds in the booking wizard · UK mobile formats (`07…`, `+447…`, `00447…`, spaced) ·
very long text and special characters in names/notes · duplicate submission and rapid
repeated clicks · 409 slot conflict · expired session · malformed JSON · network failure ·
slow responses (loading UI asserted before resolution).

## 8. Coverage priorities

In order: `src/api/client.ts` and `customerClient.ts` (silent auth failures are the worst
class of bug here) → `src/lib/*` → forms → the booking wizard → routing/auth guards →
list/filter pages → presentational chrome. Coverage is reported, and a floor is set from
the measured baseline; it is not chased as a number.

## 9. Measured coverage and what is still uncovered

Measured with `npm run test:coverage` after implementation:

| | Lines | Branches | Functions |
| --- | --- | --- | --- |
| **Overall** | **64.7%** | **88.0%** | **67.7%** |
| `src/api` (client, tokens, per-resource) | 61% | 92% | — |
| `src/auth` | 100% | 100% | 100% |
| `src/lib` | 93% | 93% | 90% |
| `src/pages` (top level) | 96% | 90% | 91% |
| `src/components` | 63% | 95% | 81% |

The floor in `vitest.config.ts` (60% lines/statements/functions, 70% branches)
was set from this measurement, not picked in advance. Branch coverage is the
high number because the suite deliberately drives error, empty and edge paths
rather than only happy paths.

**Deliberately uncovered, in rough priority order.** These are screens no test
exercises yet; each is a real gap, not a rounding error:

| Area | Coverage | Why it is the next thing to test |
| --- | --- | --- |
| `pages/employees/EmployeesList` | 2% | 459 lines, staff management CRUD |
| `pages/settings/AvailabilitySettings` | 4% | Opening hours + exceptions drive the whole public booking calendar |
| `pages/appointments/AppointmentsCalendar` | 5% | The staff diary; `lib/calendarLayout` is well covered but its consumer is not |
| `pages/appointmentTypes/ChecklistTemplateBuilder` | 5% | Per-business checklist configuration |
| `pages/appointments/AppointmentChecklistPage` | 5% | The mechanic-facing logging screen |
| `pages/communications/ContactCustomer`, `CommunicationsOverview` | 4–7% | Outbound contact; the other Communications pages are covered |
| `pages/appointmentStatuses/AppointmentStatusesList` | 4% | Per-garage status CRUD |
| `pages/appointmentTypes/AppointmentTypesList` | 7% | Appointment-type CRUD |
| `components/settings/RolesSection`, `pages/roles` | 5–27% | Role management |
| `pages/customer/CustomerAppointmentDetail` | 8% | Read-only; low risk |
| `components/Captcha` | 16% | Loads third-party vendor scripts; the *gate* it guards is tested in `BookingWizard.captcha.test.tsx`, the vendor integration is not worth faking |
| `components/TimeGridCalendar`, `communications/Dialpad`, `rich/RichStaticField` | 0–16% | Presentational; their logic lives in tested `lib/` modules |

The API modules that sit at 18–30% are thin one-line `apiFetch` wrappers; the
`apiFetch` machinery underneath them is at 97%, so the uncovered lines are URL
strings rather than behaviour.

## 10. Determinism

The suites were run repeatedly with no source changes in between — 8× for the
plain Vitest run, 12× under coverage instrumentation, and 3× for Playwright
with `--repeat-each=3 --retries=0` (228 E2E executions). Two genuine flakes
surfaced during that hunt and were fixed at the root rather than retried away:

1. An assertion on the vehicle owner's link ran immediately after a `findBy`
   on a *different* query, so it depended on both resolving in the same tick.
   Now awaited properly.
2. Testing Library's 1s default for `findBy*`/`waitFor` is not enough under V8
   coverage instrumentation, where a mocked round-trip plus a React Query
   invalidation can take longer. Raised to 3s in `src/test/setup.ts` — still
   below the 5s toast auto-dismiss, so "the toast never appeared" still fails
   as itself.

A third hazard was removed pre-emptively: `VehicleDetail.test.tsx` combined
auto-advancing fake timers with assertions on toasts that expire after 5s. It
now uses real timers and date-independent fixtures; the MOT status boundaries
it was pinning the clock for are covered in `lib/mot.test.ts` and
`MotBadge.test.tsx` instead.

A third class of non-determinism was caught by the first CI run rather than
locally: five assertions rendered times in the *runner's* timezone, so they
passed on a UK laptop (BST) and failed on a UTC runner. Both suites now pin
`Europe/London` — the same reasoning that makes `lib/datetime.ts` pin `en-GB`
rather than trusting the host's locale. Verified by running the whole suite
under `TZ=UTC`, `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`.

Playwright is configured with one retry in CI only. That is for genuine
infrastructure noise on a shared runner, not a licence for flaky assertions —
a test that needs the retry locally should be fixed.

## 11. Deliberately not tested

Backend behaviour of any kind · the real CAPTCHA vendor scripts (network, non-deterministic —
the component is stubbed and the *gate* is tested instead) · `ConversationSimulator`
(dev-only route, excluded from production builds) · exact Tailwind class strings ·
pixel-level layout.

## 12. Bugs this work found

Three real frontend defects surfaced while writing the tests. All three are
recorded in the final report; two were fixed (they were unambiguous
correctness bugs), one was documented rather than changed because the fix is a
design decision:

1. **Fixed** — the public booking wizard's `Field` rendered a `<label>` with no
   `htmlFor` and no nesting, so all nine inputs on the details step plus the
   notes textarea had *no accessible name at all*. `src/pages/customer/BookingWizard.tsx`,
   with `aria-describedby`/`aria-invalid` support added to `RichTextInput`.
2. **Fixed** — the availability calendar put `aria-pressed` on `role="gridcell"`
   (not a permitted attribute) and rendered cells directly under `role="grid"`
   with no `role="row"` between them. `src/components/customer/AvailabilityCalendar.tsx`.
3. **Fixed** — the customer filter on the vehicles list was a `<select>` with no
   label of any kind. `src/pages/vehicles/VehiclesList.tsx`.
4. **Documented, not changed** — the staff shell needs ~835px and scrolls
   sideways below that; there is no mobile navigation anywhere in the codebase.
   Pinned by `e2e/responsive.spec.ts`.
5. **Documented, not changed** — `text-slate-400` muted text (footer,
   "(optional)" markers, field hints) is ~2.9:1 on white, below WCAG AA's
   4.5:1. Pinned by `e2e/a11y.spec.ts`.
