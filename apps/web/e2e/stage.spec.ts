import { expect, test } from '@playwright/test'
import { GATE_ROUTES, V1_BODY, gateSteps, modeFor } from './helpers/gate.ts'

// The stage draws a body and plays. Project desktop has (software) WebGL; project nowebgl has
// none, so the page must fall back to the flat body and say why.

for (const route of GATE_ROUTES.stage) {
  test(`the stage draws a body and plays: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    const flat = test.info().project.name === 'nowebgl'
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(route.url)

    await gateSteps(flat ? 'flat fallback' : '3D stage', mode, async () => {
      const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
      expect(webgl, 'WebGL in this project').toBe(!flat)
      const note = page.getByText('can’t show 3D here')
      await expect(page.getByRole('img', { name: V1_BODY, exact: true })).toBeVisible()
      if (flat) await expect(note.first()).toBeVisible()
      else await expect(note).toHaveCount(0)

      const timeline = page.getByRole('slider').first()
      await page.getByRole('button', { name: 'Play' }).click()
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
      await expect(timeline).not.toHaveAttribute('aria-valuenow', '0')
      await page.getByRole('button', { name: 'Pause' }).click()
      expect(errors, 'page errors').toEqual([])
    })
  })
}
