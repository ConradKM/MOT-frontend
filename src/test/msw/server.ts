import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * One MSW server for the whole run, started in src/test/setup.ts.
 *
 * `onUnhandledRequest: 'error'` is deliberate: a request this suite did not
 * plan for is a bug in the test, not something to let fall through to a real
 * network. It is also what guarantees no test can reach the Flask backend.
 */
export const server = setupServer(...handlers)
