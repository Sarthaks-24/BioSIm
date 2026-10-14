import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'

// Heart & blood (U-3): public since the v3.0 release gate (H-1, R103), so a plain link opens it. Its
// pack loads when it is lit: the flat heart with both loops, beating at the model's rate on the real
// clock (at most 2.5 a second, size only), dashes denser where the blood goes, the rhythm chip, the
// colour key, three graphs with the book line, the children's band, the "Why different?" card and
// the held blood pressure; beside a kept plan "Where blood goes" one flow at a time. Projects
// desktop, phone, projector and reduced. E2E_SHOTS=1 saves rest, walk and kept pictures to .shots/.

const PLAN = '/sim?v=3&a=roti:1&act=walk.30.20&layer=circulation'
const REST = `${PLAN}&t=10`
const WALK = `${PLAN}&t=40`
const RUN = '/sim?v=3&a=roti:1&act=run.30.10&layer=circulation&t=38'
const KEPT = '/sim?v=3&a=roti:1&b=roti:1&t=40&act=walk.30.20&layer=circulation'

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the heart to be drawn. */
async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="circulation"]')).toBeAttached()
  await bodySettled(page)
}

/** The chip's number: the beats a minute it says. */
const chipRate = (page: Page) => page.locator('[data-rhythm-chip]').getAttribute('data-rhythm-chip').then(Number)
/** Shows a graph where they show one at a time (phone, projector): its tab. */
async function showGraph(page: Page, name: string) {
  const tab = page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name, exact: true })
  if (await tab.count()) await tab.click()
}
const shot = (page: Page, name: string) =>
  process.env.E2E_SHOTS ? page.screenshot({ path: `../../.shots/u3-circulation-${name}-${test.info().project.name}.png` }) : null

test('a link lights Heart & blood: heart, chip, colour key, three graphs, book line, band, blood pressure', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, REST)
  await expect(page.locator('[data-body="flat"][data-framing="torso"]')).toBeVisible()
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
  await expect(graphs.locator('[data-band-key]')).toContainText('Most children aged 12–15: 62–96')
  // "Why does the model differ from the book?" for the heart (R9, R82, R86).
  await graphs.getByRole('button', { name: 'Why different? ›' }).click()
  const why = graphs.locator('[data-why="sys.circulation.why"]')
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
  // No colour change per beat: the heart's pixels never change, only its transform (WCAG 2.3.1).
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

test('a link with activity and no layer opens Heart & blood (R39, live since H-1); without activity, Digestion', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  for (const url of ['/sim?v=3&a=roti:1&act=walk.30.20&t=40', '/sim?v=3&a=roti:1&act=walk.30.20&t=40&preview=1']) {
    await goto(page, url)
    await expect(page.locator('[data-system-title="circulation"]')).toBeVisible()
    await expect(page.locator('[data-layer="circulation"]')).toBeAttached()
    // Written back, the link names the layer it shows (R93).
    await expect.poll(() => new URL(page.url()).searchParams.get('layer')).toBe('circulation')
  }
  await goto(page, '/sim?v=3&a=roti:1&t=40')
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
})
