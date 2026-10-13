import { expect, test, type Page } from '@playwright/test'
import { CPU_PATH, cpuPerFrame, median } from '../scripts/cpu-frame.mjs'
import { GATE_ROUTES, bodySettled, gateSteps, measureFps, modeFor, verdict } from './helpers/gate.ts'

// 30 fps gate (roadmap A9): the CPU is slowed 6× (a cheap phone), the body is flat (project perf
// has no WebGL), and the page plays for 10 s, three times. The median counts.
// Report mode prints the number and never fails (see GATE_ROUTES.fps for why /sim still reports).
// The real 2 GB phone check: docs/PHONE-CHECK.md (first run in WP-16, again in WP-22).

/** The stage rewinds with Home on its timeline. */
async function backToStart(page: Page) {
  await page.getByRole('slider').first().press('Home')
}

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
        await backToStart(page)
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

// Main-thread CPU per frame while playing (plan qa-fixes §3.4; the probe cache/perf/abcpu.mjs),
// flat body, no throttle. Reported only, never gated: CI runners differ. The gate is the ratio
// against the base build (scripts/cpu-ratio.mjs, the CI job "perf-ab").
test('CPU per frame while playing (report)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto(CPU_PATH)
  await page.waitForLoadState('networkidle')
  const runs: { main: number; renderer: number }[] = []
  await gateSteps('CPU per frame', 'report', async () => {
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
    const cdp = await page.context().newCDPSession(page)
    for (let round = 0; round < 3; round++) runs.push(await cpuPerFrame(page, cdp, { ms: 3000, round }))
  })
  if (runs.length < 3) return
  const main = median(runs.map((r) => r.main))
  const renderer = median(runs.map((r) => r.renderer))
  verdict(
    `CPU median main ${main.toFixed(2)} ms/frame, renderer ${renderer.toFixed(2)} ms/frame (flat, 1440×900, no throttle)`,
    'report',
    [],
  )
})

// E-2 (architecture §3.1): the engine is a lazy chunk, fetched when /sim mounts. From the request
// for it to the stage drawn with the first run, at 4× CPU slowdown: p50 of 5 cold loads ≤ 400 ms.
// Report for a week, then enforce. Measured after the body has settled (bodySettled), from the
// page's own clock: the engine file's request (resource timing) to the first `[data-stage]`.
test('first run after the engine loads, 4× CPU (report)', async ({ browser }) => {
  test.setTimeout(180_000)
  const LOADS = 5
  const firstRun: number[] = []
  const toStage: number[] = []
  await gateSteps('first run', 'report', async () => {
    for (let i = 0; i < LOADS; i++) {
      // A new context each time: nothing cached, no service worker yet (a first visit).
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
      const page = await context.newPage()
      await page.addInitScript(() => {
        localStorage.setItem('lifepeek:medicalNoteSeen', '1')
        const seen = () => {
          if (!document.querySelector('[data-stage]')) return false
          ;(window as { __stageAt?: number }).__stageAt = performance.now()
          return true
        }
        new MutationObserver((_m, o) => seen() && o.disconnect()).observe(document, { subtree: true, childList: true, attributes: true })
      })
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.goto('/sim?v=2&a=cola:1')
      await bodySettled(page)
      const t = await page.evaluate(() => {
        const engine = performance.getEntriesByType('resource').find((e) => /\/run-[\w-]+\.js$/.test(e.name))
        return { engineAt: engine?.startTime ?? NaN, stageAt: (window as { __stageAt?: number }).__stageAt ?? NaN }
      })
      firstRun.push(t.stageAt - t.engineAt)
      toStage.push(t.stageAt)
      await context.close()
    }
  })
  const p50 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
  const ms = (xs: number[]) => xs.map((x) => Math.round(x)).join(', ')
  const label = `first run p50 ${Math.round(p50(firstRun))} ms from the engine request (${ms(firstRun)}); page start → stage p50 ${Math.round(p50(toStage))} ms (${ms(toStage)}); 4× CPU`
  verdict(label, 'report', firstRun.length === LOADS && p50(firstRun) <= 400 ? [] : ['over 400 ms (or not measured)'])
})
