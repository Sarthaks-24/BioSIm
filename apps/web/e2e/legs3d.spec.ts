import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, onlyIn, returningVisitor } from './helpers/gate.ts'
import { ACTIVITY_BANDS, type ActivityBand } from '../src/anatomy/human/bands.ts'
import { LIMB_KIT } from '../src/anatomy/human/kit.ts'
import { setLimbKit } from '../src/anatomy/human/limbs.ts'

// The 3D legs (A-1a; anatomy plan §1, §3, §9): in a bout the 3D body stands in the band's still pose
// (rest, walk, brisk walk, run; R32), its arms and legs tubed on the flat body's curves; at rest
// Digestion keeps today's shell. The whole-body switch eases out to the whole standing body (the
// `full` framing) for any system, with the faint skeleton ghost. The shell's depth pre-pass draws one
// outline where its parts overlap (no double rims). Projects desktop, projector, phone (WebGL) and
// nowebgl (the flat body, no switch). E2E_SHOTS=1 saves the four poses to .shots/ (git-ignored).

setLimbKit(LIMB_KIT)

/** Digestion with a 20-minute bout from 0:30, at 0:40 (in the bout) or `t`. */
const plan = (band: ActivityBand, t = 40, layer = 'digestion') =>
  `/sim?v=3&a=roti:1${band === 'rest' ? '' : `&act=${band}.30.20`}&layer=${layer}&t=${t}`

const body = (page: Page) => page.locator('[data-body="3d"]')

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the 3D body to be drawn, its legs too when the band has them. */
async function open(page: Page, url: string, band?: ActivityBand) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await bodySettled(page)
  await expect(body(page).and(page.locator('[data-ready]'))).toBeVisible({ timeout: 30_000 })
  if (band && band !== 'rest') await expect(body(page)).toHaveAttribute('data-pose', band, { timeout: 30_000 })
  // The camera's ease (600 ms) and a frame after it.
  await page.waitForTimeout(900)
}

/**
 * The 3D skin alone (the shell, with or without its pre-pass), drawn now: then, in it, the share of
 * the pane's height the body takes, and the dips of brightness along lines across the places where
 * the limbs overlap the torso (the shoulders, the hips). A dip is a pixel at least 12 grey levels
 * darker than the lightest within 6 px on both sides: an outline. Lines at scene y (front of the body).
 */
function skinAlone(page: Page, prepass: boolean) {
  return page.evaluate(async (prepass) => {
    const w = window as unknown as {
      __lifepeekScene: { traverse(fn: (o: { isMesh?: boolean; visible: boolean; renderOrder: number }) => void): void }
      __lifepeekSnap: () => string
      __lifepeekCamera: {
        position: { constructor: new (x: number, y: number, z: number) => { project(c: unknown): { x: number; y: number } } }
      }
    }
    w.__lifepeekScene.traverse((o) => {
      if (o.isMesh) o.visible = o.renderOrder === 20 || (prepass && o.renderOrder === 15)
    })
    const url = w.__lifepeekSnap()
    w.__lifepeekScene.traverse((o) => {
      if (o.isMesh) o.visible = true
    })
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    const grey = (x: number, y: number) => {
      const i = (Math.min(c.height - 1, Math.max(0, Math.round(y))) * c.width + Math.min(c.width - 1, Math.max(0, Math.round(x)))) * 4
      return 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
    }
    // Rows with any skin (darker than the white behind it).
    let top = -1
    let bottom = -1
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x += 2)
        if (grey(x, y) < 250) {
          if (top < 0) top = y
          bottom = y
          break
        }
    const V = w.__lifepeekCamera.position.constructor
    const at = (p: [number, number, number]) => {
      const q = new V(...p).project(w.__lifepeekCamera)
      return [((q.x + 1) / 2) * c.width, ((1 - q.y) / 2) * c.height] as const
    }
    const dips = (a: [number, number, number], b: [number, number, number]) => {
      const [x0, y0] = at(a)
      const [x1, y1] = at(b)
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)))
      const v = Array.from({ length: n + 1 }, (_, i) => grey(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n))
      let count = 0
      for (let i = 6; i < v.length - 6; i++) {
        const around = v.slice(i - 6, i + 7)
        if (v[i] !== Math.min(...around)) continue
        if (Math.max(...v.slice(i - 6, i)) - v[i]! >= 12 && Math.max(...v.slice(i + 1, i + 7)) - v[i]! >= 12) {
          count++
          i += 6
        }
      }
      return count
    }
    const lines: Record<string, number> = {}
    for (const side of [1, -1]) {
      lines[`shoulder ${side}`] = dips([0.3 * side, 1.8, 0.45], [0.92 * side, 1.8, 0.3])
      lines[`hip ${side}`] = dips([0.46 * side, -1.0, 0.5], [0.46 * side, -1.62, 0.45])
    }
    return { share: top < 0 ? 0 : (bottom - top + 1) / c.height, lines }
  }, prepass)
}

test('the 3D body takes the band’s still pose: today’s shell at rest, legs and posed arms in a bout (A-1a, R32)', async ({ page }) => {
  onlyIn('desktop', 'projector', 'phone')
  test.setTimeout(120_000)
  // Before the bout: Digestion at rest, no legs (its 3D picture is today's, the visual check's).
  await open(page, plan('walk', 10))
  await expect(body(page)).not.toHaveAttribute('data-pose', /.*/)
  await expect(body(page)).toHaveAttribute('data-framing', 'torso')
  for (const band of ACTIVITY_BANDS.filter((b) => b !== 'rest')) {
    await open(page, plan(band), band)
    await expect(body(page)).toHaveAttribute('data-framing', 'torso')
    // The flat body's band and the 3D body's pose are the same (BodyPane reads the clock's band).
    await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', band)
    // No skeleton ghost with Digestion at its own framing (its flat drawing has none).
    await expect(body(page)).not.toHaveAttribute('data-ghost', /.*/)
  }
})

test('the body takes at least 85 % of the pane’s height at the torso framing, at rest and in a bout (A-1a)', async ({ page }) => {
  onlyIn('desktop', 'projector', 'phone')
  for (const band of ['rest', 'run'] as const) {
    await open(page, plan(band, band === 'rest' ? 10 : 40), band)
    const { share } = await skinAlone(page, true)
    expect(share, band).toBeGreaterThanOrEqual(0.85)
  }
})

test('no double rims: with the pre-pass the shoulders and hips show one outline, in all four poses (A-1a, plan §1, §10)', async ({
  page,
}) => {
  onlyIn('desktop')
  test.setTimeout(180_000)
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  for (const band of ACTIVITY_BANDS) {
    await open(page, plan(band, band === 'rest' ? 10 : 40, 'breathing'), band)
    await page.getByRole('button', { name: 'Whole body' }).click()
    await expect(body(page)).toHaveAttribute('data-pose', band)
    await page.waitForTimeout(1200)
    const one = (await skinAlone(page, true)).lines
    const two = (await skinAlone(page, false)).lines
    // Where an arm's root sits in the shoulder, only the skin in front draws: no rim inside it.
    expect([one['shoulder 1'], one['shoulder -1']], band).toEqual([0, 0])
    // Without the pre-pass the hidden parts' rims show (the check sees a double rim)…
    expect(sum(two), band).toBeGreaterThan(sum(one))
    // …and the pre-pass never adds one.
    for (const [line, n] of Object.entries(one)) expect(n, `${band} ${line}`).toBeLessThanOrEqual(two[line]!)
  }
})

test('the whole-body switch eases out to the whole standing body with the skeleton ghost, and back (A-1a)', async ({ page }, info) => {
  onlyIn('desktop', 'projector', 'phone')
  await open(page, plan('run'), 'run')
  const button = page.getByRole('button', { name: 'Whole body' })
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(body(page)).toHaveAttribute('data-framing', 'full')
  await expect(body(page)).toHaveAttribute('data-pose', 'run')
  await expect(body(page)).toHaveAttribute('data-ghost', '')
  await page.waitForTimeout(1200)
  // The whole body, feet to head, inside the pane.
  const { share } = await skinAlone(page, true)
  expect(share).toBeGreaterThan(0.6)
  expect(share).toBeLessThan(0.99)
  // No organ label lies over the switch.
  const box = (await button.boundingBox())!
  for (const label of await page.locator('[data-body="3d"] [data-callout]').filter({ visible: true }).all()) {
    const b = (await label.boundingBox())!
    const over = b.x < box.x + box.width && b.x + b.width > box.x && b.y < box.y + box.height && b.y + b.height > box.y
    expect(over, `label ${await label.textContent()} over the switch`).toBe(false)
  }
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/a1a-whole-run-${info.project.name}.png` })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(body(page)).toHaveAttribute('data-framing', 'torso')
  await expect(body(page)).not.toHaveAttribute('data-ghost', /.*/)
})

test('the 3D legs on a 2 GB phone: the light shell, no pre-pass or ghost, at most 60k triangles and 20 draws (plan §9)', async ({
  page,
}) => {
  onlyIn('phone')
  await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }))
  const rendered = () =>
    page.evaluate(() => {
      const r = (window as unknown as { __lifepeekGl: { render: { calls: number; triangles: number } } }).__lifepeekGl.render
      return { calls: r.calls, triangles: r.triangles }
    })
  await open(page, plan('run'), 'run')
  const torso = await rendered()
  await page.getByRole('button', { name: 'Whole body' }).click()
  await expect(body(page)).toHaveAttribute('data-framing', 'full')
  await expect(body(page)).not.toHaveAttribute('data-ghost', /.*/)
  await page.waitForTimeout(1200)
  const whole = await rendered()
  console.log(`[gpu low] torso ${JSON.stringify(torso)}, whole ${JSON.stringify(whole)}`)
  for (const gl of [torso, whole]) {
    expect(gl.calls).toBeLessThanOrEqual(20)
    expect(gl.triangles).toBeLessThanOrEqual(60_000)
  }
})

test('the 3D legs, high tier (report): draws and triangles in a run, at the torso and whole (plan §9: ≤ 60 draws, ≤ 150k)', async ({
  page,
}) => {
  onlyIn('desktop')
  test.setTimeout(180_000)
  const rendered = () =>
    page.evaluate(() => {
      const r = (window as unknown as { __lifepeekGl: { render: { calls: number; triangles: number } } }).__lifepeekGl.render
      return { calls: r.calls, triangles: r.triangles }
    })
  const seen: string[] = []
  for (const layer of ['digestion', 'breathing', 'circulation', 'kidneys']) {
    await open(page, plan('run', 40, layer), 'run')
    const torso = await rendered()
    await page.getByRole('button', { name: 'Whole body' }).click()
    await page.waitForTimeout(1200)
    const whole = await rendered()
    seen.push(`${layer}: ${torso.calls} draws ${torso.triangles} tris; whole ${whole.calls} draws ${whole.triangles} tris`)
    for (const gl of [torso, whole]) {
      expect(gl.calls).toBeLessThanOrEqual(60)
      expect(gl.triangles).toBeLessThanOrEqual(150_000)
    }
  }
  console.log(`[gpu high] ${seen.join(' | ')}`)
  test.info().annotations.push({ type: 'gpu high', description: seen.join(' | ') })
})

test('shots: the four poses in 3D, whole body, turned a little (E2E_SHOTS)', async ({ page }, info) => {
  onlyIn('desktop', 'phone')
  test.skip(!process.env.E2E_SHOTS, 'E2E_SHOTS=1 saves the pictures')
  test.setTimeout(240_000)
  for (const band of ACTIVITY_BANDS) {
    await open(page, plan(band, band === 'rest' ? 10 : 40), band)
    await page.screenshot({ path: `../../.shots/a1a-legs3d-${band}-torso-${info.project.name}.png` })
    await page.getByRole('button', { name: 'Whole body' }).click()
    await page.waitForTimeout(1200)
    // A drag turns the body a third of the way to its side, so the stride shows.
    const box = (await page.locator('[data-body="3d"] canvas').boundingBox())!
    const y = box.y + box.height * 0.55
    await page.mouse.move(box.x + box.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - box.height * 0.1, y, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `../../.shots/a1a-legs3d-${band}-whole-${info.project.name}.png` })
  }
})

test('without WebGL the flat body poses and no switch shows (A-1a)', async ({ page }) => {
  onlyIn('nowebgl')
  await goto(page, plan('run'))
  await page.locator('[data-stage]').waitFor()
  await bodySettled(page)
  await expect(page.locator('[data-body][data-ready]')).toBeVisible()
  await expect(body(page)).toHaveCount(0)
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'run')
  await expect(page.getByRole('button', { name: 'Whole body' })).toHaveCount(0)
})
