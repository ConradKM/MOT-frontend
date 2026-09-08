import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Runs axe over a rendered container and fails with the offending selectors
 * and help text, rather than a bare count.
 *
 * Only rules that can be judged from the DOM alone are enabled — colour
 * contrast is excluded because jsdom applies no stylesheet, so axe would
 * report every element as "incomplete" regardless of the real design.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })

  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  )
  expect(summary, summary.join('\n\n')).toEqual([])
}
