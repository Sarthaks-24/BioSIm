import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'

// Muscles, Skin & temperature and the Bones card (U-1): the `effort` pack, hidden until the v3.0
// release gate, so only a `?preview=1` link opens them. Each is a flat layer over the full body in
// the band's still pose; muscles and skin move only with walking or running (R75); bones are
// Drawing only. Also R85 (the phone's empty card offers the walk first) and R89 (organ labels keep
// off a posed arm in the torso view). Projects desktop, phone, projector, reduced and nowebgl.
// E2E_SHOTS=1 saves rest and run pictures to .shots/ (git-ignored).

const plan = (layer: string, t: number) => `/sim?v=3&a=roti:1&act=run.30.20&layer=${layer}&preview=1&t=${t}`
const REST = 10
const RUN = 40

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the layer to be drawn in its pose. */
async function open(page: Page, layer: string, t: number) {
  await goto(page, plan(layer, t))
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator(`[data-layer="${layer}"][data-pose]`)).toBeAttached()
  await bodySettled(page)
}

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u1-${name}-${test.info().project.name}.png` })
}
const graphs = (page: Page) => page.locator('section[aria-labelledby="graphs-title"]')
const moves = 'Moves only with walking or running.'

test('muscles: rest and a run differ in pose and hatch; one graph, a Model estimate, moved only by walking or running', async ({
  page,
}) => {
  const project = test.info().project.name
  test.skip(project === 'nowebgl', 'the flat body is every v3.0 system’s picture already')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, 'muscles', REST)
  const layer = page.locator('[data-layer="muscles"]')
  await expect(page.locator('[data-body="flat"][data-framing="full"]')).toBeVisible()
  await expect(page.locator('[data-system-title="muscles"]')).toContainText('Muscles')
  await expect(layer).toHaveAttribute('data-pose', 'rest')
  await expect(layer).toHaveAttribute('data-hatch', '0')
  for (const label of ['Leg muscles', 'Arm muscles', 'Belly muscles'])
    await expect(layer.locator('[data-callout]').filter({ hasText: label })).toBeVisible()
  await expect(graphs(page).locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs(page).locator('[data-moves]')).toHaveText(moves)
  await expect(page.locator('[data-now="muscles"]').filter({ visible: true })).toContainText('resting energy use')
  await shot(page, 'muscles-rest')

  await open(page, 'muscles', RUN)
  await expect(layer).toHaveAttribute('data-pose', 'run')
  await expect(layer).toHaveAttribute('data-hatch', '3')
  await expect(layer).toHaveAttribute('data-working', 'run')
  await expect(page.locator('[data-now="muscles"]').filter({ visible: true })).toContainText(/about \d+× their resting energy · running/)
  // No kcal on the body (anatomy plan §2.4).
  await expect(layer).not.toContainText('kcal')
  // Reduced motion: the hatch steps are cuts, not fades.
  const fade = await layer
    .locator('canvas')
    .nth(1)
    .evaluate((c) => getComputedStyle(c).transitionDuration)
  if (project === 'reduced') expect(parseFloat(fade)).toBeLessThan(0.01)
  else expect(fade).toBe('0.3s')
  await shot(page, 'muscles-run')
  expect(errors).toEqual([])
})

test('skin: no drops at rest, many in a run; the thermometer card says "kept within a narrow range"; never red', async ({ page }) => {
  test.skip(test.info().project.name === 'nowebgl', 'covered by the other projects')
  await open(page, 'skin', REST)
  const layer = page.locator('[data-layer="skin"]')
  await expect(layer).toHaveAttribute('data-drops', '0')
  await expect(layer).toHaveAttribute('data-vessels', 'narrow')
  const card = page.locator('[data-thermometer]')
  await expect(card).toContainText('Body temperature: kept within a narrow range')
  await card.getByRole('button', { name: 'About body temperature' }).click()
  await expect(card).toContainText('holds it steady')
  await expect(graphs(page).locator('[data-moves]')).toHaveText(moves)
  await expect(page.locator('[data-now="skin"]').filter({ visible: true })).toContainText('no sweat from moving')
  await shot(page, 'skin-rest')

  await open(page, 'skin', RUN)
  await expect(layer).toHaveAttribute('data-drops', '12')
  await expect(layer.locator('[data-drop="on"]')).toHaveCount(12)
  await expect(layer).toHaveAttribute('data-vessels', 'wide')
  await expect(page.locator('[data-now="skin"]').filter({ visible: true })).toContainText(/about [\d,]+ mL an hour of sweat · running/)
  // Never red, never an alarm: the card's colours and the drops' are cool or neutral.
  const colours = await page.evaluate(() =>
    [...document.querySelectorAll('[data-thermometer] *, [data-thermometer], [data-drop] path')].flatMap((el) => {
      const s = getComputedStyle(el)
      return [s.color, s.backgroundColor, s.fill, s.stroke]
    }),
  )
  const red = colours.filter((c) => {
    const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number]
    return r > 150 && r > 1.6 * g && r > 1.6 * b
  })
  expect(red).toEqual([])
  await shot(page, 'skin-run')
})

test('bones: Drawing only, the card in the graphs’ place, the same pose as muscles, a 3 px outline on the projector', async ({ page }) => {
  const project = test.info().project.name
  test.skip(project === 'nowebgl', 'covered by the other projects')
  await open(page, 'bones', RUN)
  const layer = page.locator('[data-layer="bones"]')
  await expect(layer).toHaveAttribute('data-pose', 'run')
  await expect(layer).toHaveAttribute('data-outline', project === 'projector' ? '3' : '1.25')
  const card = page.locator('[data-card="bones"]')
  await expect(card).toContainText('Bones don’t change during one meal or one game.')
  await expect(card.locator('[data-status="illustration"]')).toHaveText('Drawing only')
  await expect(page.locator('[data-now="bones"]').filter({ visible: true })).toContainText('Drawing only')
  for (const label of ['Skull', 'Ball-and-socket joint', 'Hinge joint'])
    await expect(layer.locator('[data-callout]').filter({ hasText: label })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="graphs-title"] > :not([data-card]) svg')).toHaveCount(0)
  await shot(page, 'bones-run')
})

test('the picker offers the three rows under "Moving and body heat" in a preview; bones says Drawing only', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await open(page, 'muscles', RUN)
  await page.getByRole('button', { name: 'Body system: Muscles' }).click()
  const picker = page.getByRole('dialog', { name: 'Body systems' })
  const group = picker.getByRole('region', { name: /Moving/ })
  await expect(group.locator('[data-system-row]')).toHaveCount(3)
  await expect(group.locator('[data-system-row="bones"]')).toContainText('Drawing only')
  await expect(group.locator('[data-system-row="muscles"]')).toContainText(/kcal\/h, running/)
  await group.locator('[data-system-row="skin"]').click()
  await expect(page.locator('[data-system-title="skin"]')).toBeVisible()
})

test('without ?preview=1 muscles, skin and bones stay hidden: the link opens Digestion', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  for (const layer of ['muscles', 'skin', 'bones']) {
    await goto(page, `/sim?v=3&a=roti:1&act=run.30.20&layer=${layer}`)
    await page.locator('[data-stage]').waitFor()
    await expect(page.locator(`[data-layer="${layer}"]`)).toHaveCount(0)
  }
})

test('the phone’s empty card offers "Try: walk 20 min, from 0:30" first in its row (R85)', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'the phone row')
  await goto(page, '/sim?v=3&a=')
  const row = page.getByRole('list', { name: 'Foods to start with' })
  const tryBout = page.locator('[data-try-bout]')
  await expect(tryBout).toBeVisible()
  await expect(tryBout).toContainText('Try: walk 20 min, from 0:30')
  const lefts = await row
    .locator('li')
    .evaluateAll((lis) => lis.map((li) => [li.getBoundingClientRect().left, !!li.querySelector('[data-try-bout]')] as const))
  const first = [...lefts].sort((a, b) => a[0] - b[0])[0]!
  expect(first[1]).toBe(true)
  await shot(page, 'phone-empty')
})

test('in a run, the torso view’s organ labels keep off the arm in front (R89), with none lost', async ({ page }) => {
  test.skip(test.info().project.name !== 'nowebgl', 'the flat torso view (no WebGL), on the projector')
  await page.addInitScript(() => localStorage.setItem('lifepeek:projector', '1'))
  await page.setViewportSize({ width: 1280, height: 800 })
  await goto(page, '/sim?v=3&a=roti:1&act=run.30.20&t=38')
  await expect(page.locator('[data-body="flat"][data-ready]')).toBeVisible()
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'run')
  await bodySettled(page)
  for (const label of ['Liver', 'Stomach'])
    await expect(page.locator('[data-body="flat"] [data-callout]').filter({ hasText: label })).toBeVisible()
  await shot(page, 'torso-run-projector')
})
