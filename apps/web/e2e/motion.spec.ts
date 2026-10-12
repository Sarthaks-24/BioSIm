import { expect, test } from '@playwright/test'
import { GATE_ROUTES, appFramesDuring, gateSteps, installFrameCounter, modeFor, verdict } from './helpers/gate.ts'

// Reduced motion (project reduced: the browser asks for reduced motion). Nothing starts moving on
// its own, and a paused page asks for no animation frames.

for (const route of GATE_ROUTES.reducedMotion) {
  test(`reduced motion: no auto-play, and a paused page draws no frames: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    await installFrameCounter(page)
    await page.goto(route.url)
    await page.waitForLoadState('networkidle')
    await gateSteps('reduced motion: no auto-play', mode, async () => {
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
      await page.waitForTimeout(1000)
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
      await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '0')
    })
    // Let the first draw and any resize settle before counting.
    await page.waitForTimeout(1000)
    const frames = await appFramesDuring(page, 2000)
    verdict(
      'reduced motion: paused page draws no frames',
      mode,
      frames > 0 ? [`the page asked for ${frames} frames in 2 s while paused`] : [],
    )
  })
}
