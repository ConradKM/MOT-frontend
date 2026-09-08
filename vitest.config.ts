import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: this project runs vite 8
// (rolldown), and pulling `@vitejs/plugin-react` into a `vitest/config`
// `defineConfig` trips a bundled-vite type clash. Tests don't need Fast
// Refresh, so esbuild handles the JSX transform instead.
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    css: false,
    // Don't let a developer's .env.local (e.g. Turnstile dev keys) change how
    // tests behave. Suites that need the CAPTCHA on mock the component instead.
    env: { VITE_CAPTCHA_PROVIDER: '', VITE_CAPTCHA_SITE_KEY: '' },
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`; Vitest
    // must not try to collect them.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
        // Dev-only tool, never registered in a production build (see App.tsx).
        'src/pages/communications/ConversationSimulator.tsx',
        'src/api/conversationSimulator.ts',
      ],
      // A floor measured from the suite as it stands, not an aspiration — it
      // exists to catch a regression that deletes coverage, not to be chased.
      thresholds: { lines: 60, functions: 60, branches: 70, statements: 60 },
    },
  },
})
