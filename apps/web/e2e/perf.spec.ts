import { expect, test } from '@playwright/test'
import { GATE_ROUTES, gateSteps, measureFps, modeFor, verdict } from './helpers/gate.ts'

// 30 fps gate (roadmap A9): the CPU is slowed 6× (a cheap phone), the body is flat (project perf
// has no WebGL), and the page plays for 10 s, three times. The median counts.
// Report mode prints the number and never fails. The real 2 GB phone check is in WP-22.

const RUNS = 3
const PLAY_MS = 10_000

for (const route of GATE_ROUTES.fps) {
  test(`fps while playing: ${route.url}`, async ({ page }) => {
    test.setTimeout(180_000)
    const mode = modeFor(route)
    await page.goto(route.url)
    await page.waitForLoadState('networkidle')

    const runs: number[] = []
    await gateSteps('fps measurement', mode, async () => {
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
      for (let i = 0; i < RUNS; i++) {
        await page.getByRole('button', { name: 'Back to the start' }).click()
        await page.getByRole('button', { name: 'Play' }).click()
        runs.push(await measureFps(page, PLAY_MS))
        await page.getByRole('button', { name: 'Pause' }).click()
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    })

    if (runs.length < RUNS) return // gateSteps has already reported why
    const median = [...runs].sort((x, y) => x - y)[Math.floor(RUNS / 2)]!
    const label = `fps median ${median.toFixed(1)} (runs ${runs.map((r) => r.toFixed(1)).join(', ')}; 6× CPU, flat body)`
    verdict(label, mode, median >= 30 ? [] : ['below 30 fps'])
  })
}
