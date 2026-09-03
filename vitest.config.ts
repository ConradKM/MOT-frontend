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
  },
})
