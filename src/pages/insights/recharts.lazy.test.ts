import { describe, expect, it } from 'vitest'

// Every source file's text, at test time (Vite resolves the glob).
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const IMPORTS_RECHARTS = /from\s+['"]recharts['"]|import\(\s*['"]recharts['"]\s*\)/

describe('Recharts stays out of the main bundle', () => {
  it('is imported by the lazily loaded chart module and nothing else', () => {
    const importers = Object.entries(sources)
      .filter(([, text]) => IMPORTS_RECHARTS.test(text))
      .map(([path]) => path)

    expect(importers).toEqual(['/src/pages/insights/charts/TrendChart.tsx'])
  })

  it('is only ever reached through React.lazy', () => {
    const staticImports = Object.entries(sources)
      .filter(([, text]) => /from\s+['"][./]+charts\/TrendChart['"]/.test(text))
      .map(([path]) => path)

    expect(staticImports).toEqual([])
    expect(sources['/src/pages/insights/InsightsPanels.tsx']).toMatch(
      /lazy\(\(\) => import\('\.\/charts\/TrendChart'\)\)/,
    )
  })
})
