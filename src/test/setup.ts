import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { server } from './msw/server'

// Testing Library's 1s default for findBy*/waitFor is comfortably enough on a
// dev machine but not under V8 coverage instrumentation on a shared CI runner,
// where a mocked round-trip plus a React Query invalidation can take longer.
// Kept below the 5s toast auto-dismiss so a "toast never appeared" failure
// still surfaces as one, rather than being masked by a longer wait.
configure({ asyncUtilTimeout: 3000 })

// One MSW server for the whole run. `error` on an unhandled request is the
// guard that keeps this suite isolated: nothing can quietly reach the Flask
// backend, and a request a test forgot to plan for fails loudly instead of
// hanging.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Tokens live in localStorage, so a signed-in test would otherwise leak its
  // session into the next file's tests.
  localStorage.clear()
  sessionStorage.clear()
})

afterAll(() => server.close())

// jsdom implements no layout, so it ships no scrollIntoView. Components that
// keep a highlighted item in view (RichDropdown) call it during a normal
// render; without this stub they throw here but work fine in every browser.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
