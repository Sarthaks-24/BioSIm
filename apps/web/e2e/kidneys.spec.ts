import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'
import { anchorsOf, labelsOffWhileTurning } from './helpers/labels3d.ts'
import KIDNEYS_3D from '../src/three/layers/kidneys.ts'

// Kidneys & water (U-4): public since the v3.0 release gate (H-1, R103), so a plain link opens it.
// Its pack loads when it is lit: the flat kidneys, ureters and bladder with its gauge, two graphs on
// a 0–12 h window (the dock says so, "48 h ›" widens it) with the background urine line, the
// "moves with" line and the filtering card with its source line. Projects desktop, phone, projector
// and reduced, drawn in 3D there (A-6), and nowebgl, drawn flat. E2E_SHOTS=1 saves rest, water and
// walk pictures to .shots/ (git-ignored).

const BASE = '/sim?v=3&layer=kidneys'
const REST = `${BASE}&a=roti:1&t=80`
const WATER = `${BASE}&a=water:2&t=80`
const WALK = `${BASE}&a=water:2&act=walk.30.60&t=80`

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the kidneys picture to be drawn. */
async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="kidneys"]').first()).toBeAttached()
  await bodySettled(page)
  // With WebGL the flat kidneys stand in until the 3D ones have drawn (A-6): then only one picture is left.
  await expect(page.locator('[data-layer="kidneys"]')).toHaveCount(1, { timeout: 30_000 })
}

/** Whether this project draws the 3D kidneys (every project with WebGL). */
const in3d = () => test.info().project.name !== 'nowebgl'

/** The urine an hour the Now line says. */
const nowUrine = async (page: Page) =>
  Number((await page.locator('[data-now="kidneys"]').filter({ visible: true }).first().innerText()).match(/urine (\d+) mL an hour/)![1])

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u4-kidneys-${name}-${test.info().project.name}.png` })
}

test('a link lights kidneys & water: picture, gauge, two graphs on 0–12 h with the background line', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, WATER)
  // With WebGL the 3D kidneys (A-6), else the flat ones: the torso framing either way.
  await expect(
    page.locator(in3d() ? '[data-body="3d"][data-framing="torso"][data-ready]' : '[data-body="flat"][data-framing="torso"]'),
  ).toBeVisible()
  await expect(page.locator('[data-system-title="kidneys"]')).toContainText('Kidneys & water')
  for (const label of ['Kidney', 'Urinary bladder'])
    await expect(page.locator('[data-layer="kidneys"] [data-callout]').filter({ hasText: label }).first()).toBeVisible()
  // The gauge: marks at 150 and 300 mL; the drawn bladder never above 600.
  await expect(page.locator('[data-gauge] [data-mark]')).toHaveCount(2)
  await expect(page.locator('[data-gauge]')).toContainText('150 mL')
  await expect(page.locator('[data-gauge]')).toContainText('300 mL')
  await expect(page.locator('[data-layer="kidneys"]')).toHaveAttribute('data-bladder-drawn', /^\d+$/)
  expect(Number(await page.locator('[data-layer="kidneys"]').getAttribute('data-bladder-drawn'))).toBeLessThanOrEqual(600)
  // The graphs: "Model estimate", the background line on the urine graph, the window on the dock.
  const graphs = page.locator('section[aria-labelledby="graphs-title"]')
  await expect(graphs.locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs.locator('[data-line="second"]').first()).toBeAttached()
  await expect(page.locator('[data-window="720"]')).toHaveText('0–12 h shown · 48 h ›')
  if (test.info().project.name !== 'phone') {
    await expect(graphs.locator('[data-strip-note]').first()).toContainText('Moves with water in food and drink, and with sweat.')
    await expect(graphs.locator('[data-constant="filtration"]')).toContainText('125 mL a minute')
    await expect(graphs.locator('[data-constant="filtration"] [data-source]')).toContainText('Source: OpenStax')
  }
  expect(errors).toEqual([])
})

test('rest, water and a walk visibly differ: more urine with water, less with the walk’s sweat', async ({ page }) => {
  await open(page, REST)
  const rest = await nowUrine(page)
  await shot(page, 'rest')
  await open(page, WATER)
  const water = await nowUrine(page)
  await shot(page, 'water')
  await open(page, WALK)
  const walk = await nowUrine(page)
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'walk')
  await shot(page, 'walk')
  expect(water).toBeGreaterThan(rest + 50)
  expect(walk).toBeLessThan(water - 20)
})

test('the dock shows 0–12 h; “48 h ›” widens it to the whole bar and back', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await open(page, WATER)
  const slider = page.getByRole('slider', { name: /time/i }).first()
  await expect(slider).toHaveAttribute('aria-valuemax', '720')
  await page.locator('[data-window]').click()
  await expect(page.locator('[data-window="2880"]')).toHaveText('48 h shown · 0–12 h ›')
  await expect(page.getByRole('slider', { name: /time/i }).first()).toHaveAttribute('aria-valuemax', '2880')
  await page.locator('[data-window]').click()
  await expect(page.locator('[data-window="720"]')).toBeVisible()
  // On the row before (Heart & blood) the bar is 48 h with no window button.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('[')
  await expect(page.locator('[data-system-title="circulation"]')).toBeVisible()
  await expect(page.locator('[data-window]')).toHaveCount(0)
  await expect(page.getByRole('slider', { name: /time/i }).first()).toHaveAttribute('aria-valuemax', '2880')
})

test('the ureters’ drops move in pulses on the real clock; reduced motion stands still with arrows', async ({ page }) => {
  await open(page, WATER)
  const layer = page.locator('[data-layer="kidneys"]')
  const reduced = test.info().project.name === 'reduced'
  await expect(layer).toHaveAttribute('data-drops', reduced ? 'still' : 'moving')
  if (reduced) {
    await expect(layer.locator('[data-arrows]')).toBeAttached()
    if (in3d()) {
      // Two still arrows, drawn; the drops stand still (the read-out never moves).
      await expect(layer.locator('[data-arrows] path[d^="M"]')).toHaveCount(2)
      const flow = await layer.getAttribute('data-drops-flow')
      await page.waitForTimeout(600)
      expect(await layer.getAttribute('data-drops-flow')).toBe(flow)
    }
    return
  }
  // Flat: the drops' SVG dashes; 3D: how far the drops have moved down the ureters (the shader's dashes).
  const read = in3d()
    ? () => layer.getAttribute('data-drops-flow').then(String)
    : () => layer.locator('[data-ureter-drops]').evaluate((el) => (el as SVGElement).style.strokeDashoffset)
  const offsets = new Set<string>()
  for (let i = 0; i < 8; i++) {
    offsets.add(await read())
    await page.waitForTimeout(150)
  }
  expect(offsets.size).toBeGreaterThan(2)
})

test('scrubbing the clock fast: the bladder’s drawn size changes at most once a second', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await open(page, `${BASE}&a=water:4&t=0`)
  const layer = page.locator('[data-layer="kidneys"]')
  const track = page.getByRole('slider', { name: /time/i }).first()
  const box = (await track.boundingBox())!
  // Watch the drawn size from inside the page while the pointer drags across the bar for 2 s.
  await page.evaluate(() => {
    const el = document.querySelector('[data-layer="kidneys"]')!
    const w = window as unknown as { changes: number[] }
    w.changes = []
    new MutationObserver(() => w.changes.push(performance.now())).observe(el, { attributeFilter: ['data-bladder-drawn'] })
  })
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(box.x + 2 + ((box.width - 4) * (i % 20)) / 19, box.y + box.height / 2)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  const changes = await page.evaluate(() => (window as unknown as { changes: number[] }).changes)
  for (let i = 1; i < changes.length; i++) expect(changes[i]! - changes[i - 1]!).toBeGreaterThanOrEqual(950)
  await expect(layer).toHaveAttribute('data-bladder-drawn', /\d+/)
})

test('a ?preview=1 link still opens kidneys & water; Digestion has no 0–12 h window', async ({ page }) => {
  await goto(page, '/sim?v=3&a=water:1&layer=kidneys&preview=1')
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="kidneys"]').first()).toBeAttached()
  await expect(page.locator('[data-window="720"]')).toBeAttached()
  await goto(page, '/sim?v=3&a=water:1')
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-window]')).toHaveCount(0)
})

test('the 3D kidneys (A-6): water and a walk visibly differ, the bladder at most 600 mL, the GPU within plan §9; shots', async ({
  page,
}, info) => {
  test.skip(!['desktop', 'projector', 'phone', 'reduced'].includes(info.project.name), 'WebGL projects')
  test.setTimeout(180_000)
  const body = page.locator('[data-body="3d"][data-layer="kidneys"]')
  const rendered = () =>
    page.evaluate(() => {
      const r = (window as unknown as { __lifepeekGl: { render: { calls: number; triangles: number } } }).__lifepeekGl.render
      return { calls: r.calls, triangles: r.triangles }
    })
  const shot3d = (name: string) =>
    process.env.E2E_SHOTS ? page.screenshot({ path: `../../.shots/a6-kidneys3d-${name}-${info.project.name}.png` }) : null
  /** The bladder's drawn mL once the picture has settled (the gate moves it at most once a second). */
  const bladder = async () => {
    await expect(body).toHaveAttribute('data-bladder-drawn', /^\d+$/, { timeout: 30_000 })
    await page.waitForTimeout(1200)
    return Number(await body.getAttribute('data-bladder-drawn'))
  }
  await open(page, `${BASE}&a=roti:1&t=30`)
  const rest = await bladder()
  const gl = await rendered()
  expect(gl.calls).toBeLessThanOrEqual(60)
  expect(gl.triangles).toBeLessThanOrEqual(150_000)
  await shot3d('rest')
  // Four glasses of water, two hours on: much more urine made, a fuller bladder (never drawn above 600 mL).
  await open(page, `${BASE}&a=water:4&t=150`)
  const water = await bladder()
  await shot3d('water')
  expect(water).toBeGreaterThan(rest)
  expect(water).toBeLessThanOrEqual(600)
  if (info.project.name !== 'reduced') {
    await expect(body).toHaveAttribute('data-drops', 'moving')
    expect(Number(await body.getAttribute('data-urine-rate'))).toBeGreaterThan(100)
  } else await expect(body).toHaveAttribute('data-drops', 'still')
  await open(page, WALK)
  await shot3d('walk')
  // The gauge's marks, as the flat one's; the labels on the 3D organs.
  await expect(body.locator('[data-gauge] [data-mark]')).toHaveCount(2)
  await expect(body.locator('[data-callout]').filter({ hasText: 'Kidney' }).first()).toBeVisible()
})

test('the 3D kidneys on a 2 GB phone: the light mesh, at most 60k triangles and 20 draws (plan §9)', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'one phone project')
  await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }))
  await open(page, WATER)
  await expect(page.locator('[data-body="3d"][data-layer="kidneys"][data-drops]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(800)
  const { gl, held } = await page.evaluate(() => {
    const w = window as unknown as {
      __lifepeekGl: { render: { calls: number; triangles: number } }
      __lifepeek3d: () => { layers: string[] }
    }
    return { gl: { calls: w.__lifepeekGl.render.calls, triangles: w.__lifepeekGl.render.triangles }, held: w.__lifepeek3d().layers }
  })
  expect(held).toContain('low:kidneys')
  expect(gl.calls).toBeLessThanOrEqual(20)
  expect(gl.triangles).toBeLessThanOrEqual(60_000)
})

test('the 3D kidneys’ labels stay on their organs while the view is turned (R106)', async ({ page }, info) => {
  test.skip(!['desktop', 'projector', 'phone'].includes(info.project.name), 'WebGL projects with motion')
  await open(page, WATER)
  await expect(page.locator('[data-body="3d"][data-layer="kidneys"][data-ready]')).toBeVisible({ timeout: 30_000 })
  expect(await labelsOffWhileTurning(page, anchorsOf(KIDNEYS_3D))).toEqual([])
})
