import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against a real production build served by `vite preview`, so what
 * is tested is the artifact CI actually builds — not the dev server.
 *
 * Every /api/** call is intercepted per test (see e2e/fixtures/api.ts). No
 * Flask backend or database is involved, in CI or locally.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // A `.only` left in a spec would silently shrink the suite in CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    // VITE_API_BASE_URL is deliberately empty: the app then calls same-origin
    // /api/**, which is exactly what page.route() intercepts.
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_API_BASE_URL: '', VITE_CAPTCHA_PROVIDER: '', VITE_CAPTCHA_SITE_KEY: '' },
  },
})
