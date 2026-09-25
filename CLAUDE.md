# CLAUDE.md — MOT-frontend

Read this before making changes. It exists to keep every prompt/session working
against the same facts instead of re-deriving them from scratch each time.

## What this is

React + TypeScript SPA (Vite 8/rolldown, Tailwind 4) for a multi-tenant MOT/garage
SaaS. Talks to the Flask backend in the sibling `MOT-backend` repo over `/api`
(proxied by Vite in dev — no CORS setup needed). Full architecture notes live in
[README.md](README.md); full test strategy lives in [docs/TESTING.md](docs/TESTING.md) — read
that before adding or restructuring tests, it documents layers, mocking strategy,
and the critical user journeys the suite protects.

## Before opening a PR — mirror `.github/workflows/frontend-ci.yml` locally

CI has two required jobs (`quality`, `e2e`) gated behind a single `frontend-ci`
status check. Run the equivalent locally before pushing:

```bash
npm run lint          # oxlint
npm run typecheck     # tsc -b
npm run test:coverage # vitest run --coverage — enforces the floor below
npm run build         # tsc -b && vite build
npm run test:e2e      # playwright, against the built app (npx playwright install --with-deps chromium first time)
```

Or just `npm run ci` to run lint → typecheck → coverage → build → e2e in one shot.

- **Coverage floor** (`vitest.config.ts`): lines 60 / functions 60 / branches 70 /
  statements 60. It's a regression floor, not a target — don't chase it up, don't
  let it drop.
- **PR title/description must reference an issue number** (e.g. `#123`) —
  enforced by `pr-linked-issue.yml` via the GitHub Development sidebar link, and
  re-checked on every edit to the PR.
- Playwright specs live in `e2e/` and must never be picked up by Vitest (already
  excluded in `vitest.config.ts`) — don't add app tests there or e2e specs under `src/`.

## Conventions worth knowing before writing code

- **No new frameworks without asking**: no form library, no Redux/Zustand, no JS
  breakpoint logic (`matchMedia`, mobile drawers) — this app deliberately does
  responsive layout in Tailwind CSS only, and forms with hand-rolled `useState` +
  manual validators. Match existing patterns rather than introducing new ones.
- **Server state** goes through TanStack Query, declared in `src/api/queries.ts` —
  don't hand-roll a new fetch/useEffect for data the app already queries.
- **Errors**: `ApiError` (`src/lib/errors.ts`) maps 422s to per-field errors and
  everything else to a form-level message — reuse it, don't invent a new shape.
- **Auth**: staff and customer sessions are fully separate JWT stores
  (`mot_*` vs `mot_customer_*` in `localStorage`); don't cross them.
- **Test convention**: colocated `*.test.ts(x)`, MSW for integration-level API
  mocking (`src/test/msw/handlers.ts`), `vi.mock('../../api/<resource>')` for
  focused component tests. New tests should follow whichever convention matches
  the layer they're in — see docs/TESTING.md §3.
- Known backend gaps that shape the UI (no staff-list endpoint, no "who am I"
  endpoint) are documented in README.md "Known gap" sections — check there before
  assuming an endpoint exists.

## Cross-repo changes

If a change needs a new/changed API contract, it needs a matching change in
`MOT-backend` (sibling directory) — check its CI (`.github/workflows/ci.yml`)
requirements too; see that repo's own `CLAUDE.md`.
