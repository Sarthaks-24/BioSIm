import { test, type Page } from '@playwright/test'
import { bodySettled, verdict } from './helpers/gate.ts'

// A whole lesson on one open page (T7, FP-7; qa-fixes §1, "long lessons"). Nightly only (project
// lesson, E2E_NIGHTLY=1), report: 40 minutes (E2E_LESSON_MIN) of what a teacher does — play, pause,
// scrub, step through the moments, open and close the food sheet, switch projector mode — then
// the page must hold no more than it did after the first round: JS heap after GC ≤ +20 %, one
// WebGL context, and three.js's geometries and textures back at their first count.

const MINUTES = Number(process.env.E2E_LESSON_MIN ?? 40)

// A step that cannot finish fails in seconds, not at the end of the hour.
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })

interface Snapshot {
  heap: number
  contexts: number
  geometries: number
  textures: number
}

async function snapshot(page: Page): Promise<Snapshot> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.detach()
  return page.evaluate(() => {
    const w = window as unknown as {
      __lessonContexts?: Set<HTMLCanvasElement>
      __lifepeekGl?: { memory: { geometries: number; textures: number } }
    }
    const live = [...(w.__lessonContexts ?? [])].filter((c) => c.isConnected).length
    const memory = w.__lifepeekGl?.memory ?? { geometries: 0, textures: 0 }
    return {
      heap: (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize,
      contexts: live,
      geometries: memory.geometries,
      textures: memory.textures,
    }
  })
}

/** One round of a teacher's moves, about a minute long. */
async function round(page: Page) {
  const slider = page.getByRole('slider').first()
  await slider.press('Home')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(15_000)
  await page.getByRole('button', { name: 'Pause' }).click()
  for (const key of ['ArrowRight', 'ArrowRight', 'End', 'Home']) await slider.press(key)
  const add = page.getByRole('button', { name: 'Add food' }).filter({ visible: true }).first()
  if (await add.count()) {
    await add.click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await sheet.waitFor()
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(30_000)
  await page.getByRole('button', { name: 'Pause' }).click()
}

test('a 40-minute lesson leaves no leaks (heap, WebGL contexts, three.js memory)', async ({ page }) => {
  test.skip(test.info().project.name !== 'lesson', 'nightly only (E2E_NIGHTLY=1)')
  test.setTimeout((MINUTES + 10) * 60_000)
  // Every canvas that gets a WebGL context (the WebGL probe's is never in the page, so not counted).
  await page.addInitScript(() => {
    const w = window as unknown as { __lessonContexts: Set<HTMLCanvasElement> }
    w.__lessonContexts = new Set()
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = (get as (...a: unknown[]) => unknown).call(this, type, ...rest)
      if (ctx && /webgl/.test(type)) w.__lessonContexts.add(this)
      return ctx
    } as typeof get
  })
  await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1')
  await bodySettled(page)
  await round(page)
  const base = await snapshot(page)
  const end = Date.now() + MINUTES * 60_000
  let rounds = 1
  while (Date.now() < end) {
    await round(page)
    rounds++
  }
  const last = await snapshot(page)
  const problems: string[] = []
  const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`
  if (last.heap > base.heap * 1.2) problems.push(`heap after GC ${mb(base.heap)} → ${mb(last.heap)} (> +20 %) after ${rounds} rounds`)
  if (last.contexts !== 1) problems.push(`${last.contexts} WebGL contexts in the page (1 expected)`)
  if (last.geometries > base.geometries) problems.push(`three.js geometries ${base.geometries} → ${last.geometries}`)
  if (last.textures > base.textures) problems.push(`three.js textures ${base.textures} → ${last.textures}`)
  test.info().annotations.push({ type: 'lesson', description: JSON.stringify({ rounds, base, last }) })
  verdict(`${MINUTES}-min lesson`, 'report', problems)
})
