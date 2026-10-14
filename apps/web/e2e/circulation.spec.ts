import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'

// Heart & blood (U-3): hidden until the v3.0 release gate, so only a `?preview=1` link opens it. Its
// pack loads when it is lit: the flat heart with both loops, beating at the model's rate on the real
// clock (at most 2.5 a second, size only), dashes denser where the blood goes, the rhythm chip, the
// colour key, three graphs with the book line, the children's band, the "Why different?" card and
// the held blood pressure; beside a kept plan "Where blood goes" one flow at a time. Projects
// desktop, phone, projector and reduced, drawn in 3D there (A-5), and nowebgl, drawn flat. E2E_SHOTS=1
// saves rest, walk and kept pictures to .shots/.

const PLAN = '/sim?v=3&a=roti:1&act=walk.30.20&layer=circulation&preview=1'
const REST = `${PLAN}&t=10`
const WALK = `${PLAN}&t=40`
const RUN = '/sim?v=3&a=roti:1&act=run.30.10&layer=circulation&preview=1&t=38'
const KEPT = '/sim?v=3&a=roti:1&b=roti:1&t=40&act=walk.30.20&layer=circulation&preview=1'

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the heart to be drawn. */
async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="circulation"]').first()).toBeAttached()
  await bodySettled(page)
  // With WebGL the flat heart stands in until the 3D one has drawn (A-5): then only one picture is left.
  await expect(page.locator('[data-layer="circulation"]')).toHaveCount(1, { timeout: 30_000 })
}

/** Whether this project draws the 3D heart (every project with WebGL). */
const in3d = () => test.info().project.name !== 'nowebgl'

/** The chip's number: the beats a minute it says. */
const chipRate = (page: Page) => page.locator('[data-rhythm-chip]').getAttribute('data-rhythm-chip').then(Number)
/** Shows a graph where they show one at a time (phone, projector): its tab. */
async function showGraph(page: Page, name: string) {
  const tab = page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name, exact: true })
  if (await tab.count()) await tab.click()
}
const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS ? page.screenshot({ path: `../../.shots/u3-circulation-${name}-${test.info().project.name}.png` }) : null

test('a preview link lights Heart & blood: heart, chip, colour key, three graphs, book line, band, blood pressure', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, REST)
  // With WebGL the 3D heart in the chest framing (A-5), else the flat one in the torso framing.
  await expect(
    page.locator(in3d() ? '[data-body="3d"][data-framing="chest"][data-ready]' : '[data-body="flat"][data-framing="torso"]'),
  ).toBeVisible()
  await expect(page.locator('[data-system-title="circulation"]')).toContainText('Heart & blood')
  await expect(page.locator('[data-rhythm-chip]')).toContainText(/6\d/)
  for (const [key, label] of <[string, string][]>[
    ['heart', 'Heart'],
    ['aorta', 'Aorta (to the body)'],
    ['venaCava', 'Vena cava (back to the heart)'],
  ])
    await expect(page.locator(`[data-layer="circulation"] [data-callout="${key}"]`)).toHaveText(label)
  await expect(page.locator('[data-blood-key]')).toContainText('Blue is a convention: blood is always red.')
  const graphs = page.locator('section[aria-labelledby="graphs-title"]')
  await expect(graphs.locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs.locator('[data-reference]')).toHaveCount(1)
  await expect(graphs.locator('[data-book]')).toHaveText('Older NCERT Class 7 book (2024-25) says: 72–80 beats a minute')
  await expect(graphs.locator('[data-band-key]')).toContainText('Most children your age (12–15): 62–96')
  // "Why does the model differ from the book?" for the heart (R9, R82, R86).
  await graphs.getByRole('button', { name: 'Why different? ›' }).click()
  const why = graphs.locator('[data-why="circulation"]')
  await expect(why).toContainText('Why does the model differ from the book?')
  await expect(why.locator('[data-why-row]')).toHaveCount(3)
  await expect(why).toContainText('no slow after-exercise rise')
  await expect(why).toContainText('In the exam, write the book’s value.')
  // The blood pressure is a held book value, never a graph (on a phone it is under its own tab).
  await showGraph(page, 'Blood pumped a minute')
  await expect(graphs.locator('[data-bp-card]')).toContainText('Blood pressure 120/80: book value, held.')
  expect(errors).toEqual([])
})

test('rest and a walk visibly differ: faster beat, faster dashes, denser to the legs', async ({ page }) => {
  await open(page, REST)
  const layer = page.locator('[data-layer="circulation"]')
  const rest = await chipRate(page)
  await expect(layer).toHaveAttribute('data-dash-legs', '1')
  await shot(page, 'rest')
  await open(page, WALK)
  // The 3D heart writes its read-out a few times a second, from its first frames.
  await expect(layer).toHaveAttribute('data-dash-speed', /\d/)
  const walk = await chipRate(page)
  await expect(page.locator('[data-rhythm-chip]')).toContainText(/walking/)
  await shot(page, 'walk')
  expect(rest).toBeGreaterThanOrEqual(60)
  expect(walk).toBeGreaterThan(rest + 20)
  expect(Number(await layer.getAttribute('data-dash-legs'))).toBeGreaterThanOrEqual(3)
  expect(Number(await layer.getAttribute('data-dash-speed'))).toBeGreaterThan(1.5)
})

test('the beat moves on the real clock, size only, at most 2.5 a second; a run says "animation slowed"; reduced motion stands still', async ({
  page,
}) => {
  await open(page, RUN)
  const layer = page.locator('[data-layer="circulation"]')
  const reduced = test.info().project.name === 'reduced'
  await expect(layer).toHaveAttribute('data-beat', reduced ? 'still' : 'moving')
  // The run's ≈ 160 is drawn at 2.5 Hz; the number stays true.
  expect(await chipRate(page)).toBeGreaterThan(150)
  await expect(page.locator('[data-rhythm-chip]')).toContainText('animation slowed')
  expect(Number(await layer.getAttribute('data-beat-hz'))).toBeLessThanOrEqual(2.5)
  if (in3d()) {
    // 3D: the ventricles' drawn size changes with the beat; nothing else (the layer writes only the
    // heart's size per beat, never a state or a colour: three/layers/circulation.test.ts).
    const sizes = await layer.evaluate(
      (el: HTMLElement) =>
        new Promise<string[]>((done) => {
          const seen = new Set<string>()
          const t0 = performance.now()
          const timer = setInterval(() => {
            seen.add(el.dataset.ventricleScale!)
            if (performance.now() - t0 < 2500) return
            clearInterval(timer)
            done([...seen])
          }, 20)
        }),
    )
    if (reduced) {
      expect(sizes).toEqual(['1.000'])
      await expect(layer.locator('[data-arrows] path')).not.toHaveCount(0)
    } else expect(sizes.length).toBeGreaterThan(1)
    return
  }
  // Flat: no colour change per beat: the heart's pixels never change, only its transform (WCAG 2.3.1).
  const sample = () =>
    layer.evaluate((el) =>
      [...el.querySelectorAll('canvas')]
        .slice(1)
        .map((c) => ({ px: c.toDataURL().length + c.toDataURL().slice(-64), t: c.style.transform })),
    )
  const frames = []
  for (let i = 0; i < 8; i++) {
    frames.push(await sample())
    await page.waitForTimeout(70)
  }
  expect(new Set(frames.map((f) => f.map((c) => c.px).join()))).toHaveProperty('size', 1)
  const transforms = new Set(frames.map((f) => f.map((c) => c.t).join()))
  if (reduced) {
    expect(transforms.size).toBe(1)
    await expect(layer.locator('[data-arrows]')).toBeAttached()
  } else expect(transforms.size).toBeGreaterThan(2)
})

test('beside a kept plan, "Where blood goes" shows one flow at a time against its kept ghost', async ({ page }) => {
  await open(page, KEPT)
  const graphs = page.locator('section[aria-labelledby="graphs-title"]')
  await showGraph(page, 'Where blood goes')
  const pick = graphs.locator('[data-flow-pick]')
  await expect(pick).toHaveAttribute('data-flow-pick', '0')
  await expect(graphs).toContainText('Blood to the gut')
  await pick.getByRole('button', { name: 'Muscles' }).click()
  await expect(pick).toHaveAttribute('data-flow-pick', '1')
  await expect(graphs).toContainText('Blood to the muscles')
  await expect(pick.getByRole('button', { name: 'Muscles' })).toHaveAttribute('aria-pressed', 'true')
  await shot(page, 'kept')
})

test('a link with activity and no layer opens Heart & blood in a preview (R39); without one, Digestion until the row is public', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await goto(page, '/sim?v=3&a=roti:1&act=walk.30.20&t=40&preview=1')
  await expect(page.locator('[data-system-title="circulation"]')).toBeVisible()
  await expect(page.locator('[data-layer="circulation"]')).toBeAttached()
  await goto(page, '/sim?v=3&a=roti:1&act=walk.30.20&t=40')
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(page.locator('[data-layer="circulation"]')).toHaveCount(0)
})

test('the 3D heart (A-5): rest and a walk visibly differ, the GPU within plan §9; shots', async ({ page }, info) => {
  test.skip(!['desktop', 'projector', 'phone'].includes(info.project.name), 'WebGL projects with motion')
  test.setTimeout(180_000)
  const heart = page.locator('[data-body="3d"][data-layer="circulation"]')
  /** The ventricles' sizes drawn over a few beats (read in the page), the drawn rate and the beat's squeeze. */
  const sample = async () => {
    await expect(heart).toHaveAttribute('data-beat', 'moving', { timeout: 30_000 })
    return page.evaluate(
      () =>
        new Promise<{ sizes: number; hz: number; squeeze: number }>((done) => {
          const el = document.querySelector<HTMLElement>('[data-body="3d"][data-layer="circulation"]')!
          const sizes = new Set<string>()
          const t0 = performance.now()
          const timer = setInterval(() => {
            sizes.add(el.dataset.ventricleScale!)
            if (performance.now() - t0 < 3000) return
            clearInterval(timer)
            done({ sizes: sizes.size, hz: Number(el.dataset.beatHz), squeeze: Number(el.dataset.squeeze) })
          }, 20)
        }),
    )
  }
  const rendered = () =>
    page.evaluate(() => {
      const r = (window as unknown as { __lifepeekGl: { render: { calls: number; triangles: number } } }).__lifepeekGl.render
      return { calls: r.calls, triangles: r.triangles }
    })
  const shot3d = (name: string) =>
    process.env.E2E_SHOTS ? page.screenshot({ path: `../../.shots/a5-heart3d-${name}-${info.project.name}.png` }) : null
  await open(page, REST)
  const rest = await sample()
  await expect(heart).toHaveAttribute('data-dash-legs', '1')
  const gl = await rendered()
  expect(gl.calls).toBeLessThanOrEqual(60)
  expect(gl.triangles).toBeLessThanOrEqual(150_000)
  await shot3d('rest')
  await open(page, WALK)
  const walk = await sample()
  await shot3d('walk')
  // Faster, a bigger squeeze (more blood per beat), dashes faster and denser to the legs; never past 2.5 a second.
  expect(walk.hz).toBeGreaterThan(rest.hz + 0.3)
  expect(walk.hz).toBeLessThanOrEqual(2.5)
  expect(walk.squeeze).toBeGreaterThan(rest.squeeze + 0.01)
  expect(walk.squeeze).toBeLessThanOrEqual(0.12)
  expect(Math.min(rest.sizes, walk.sizes)).toBeGreaterThan(1)
  expect(Number(await heart.getAttribute('data-dash-legs'))).toBeGreaterThanOrEqual(3)
  expect(Number(await heart.getAttribute('data-dash-speed'))).toBeGreaterThan(1.5)
  // The colour key and its caption, as the flat drawing's.
  await expect(heart.locator('[data-blood-key]')).toContainText('Blue is a convention: blood is always red.')
})

test('the 3D heart on a 2 GB phone: the light mesh, at most 60k triangles and 20 draws (plan §9)', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'one phone project')
  await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }))
  await open(page, WALK)
  await expect(page.locator('[data-body="3d"][data-layer="circulation"][data-beat]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(800)
  const { gl, held } = await page.evaluate(() => {
    const w = window as unknown as {
      __lifepeekGl: { render: { calls: number; triangles: number } }
      __lifepeek3d: () => { layers: string[] }
    }
    return { gl: { calls: w.__lifepeekGl.render.calls, triangles: w.__lifepeekGl.render.triangles }, held: w.__lifepeek3d().layers }
  })
  expect(held).toContain('low:circulation')
  expect(gl.calls).toBeLessThanOrEqual(20)
  expect(gl.triangles).toBeLessThanOrEqual(60_000)
})
