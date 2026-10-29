import type { Page } from '@playwright/test'

/**
 * Picks MOT test on the booking page and moves on to Date & time.
 *
 * Service groups start closed, and picking a service only selects it - the
 * summary overlay's Next is the one way forward - so every walk through the
 * wizard goes: open the group, pick, Next.
 */
export async function chooseMotTest(page: Page) {
  await page.getByRole('button', { name: /^Testing & servicing/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('region', { name: 'MOT test' }).getByRole('button', { name: 'Next' }).click()
}
