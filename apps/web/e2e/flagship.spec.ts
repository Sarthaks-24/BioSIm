import { expect, test, type Page } from '@playwright/test'
import { checkAxe, goto, measureBody, returningVisitor } from './helpers/gate.ts'

// The flagship guided lesson, "One roti, one walk" (X-1; ui-ux §8.1, content-i18n §8.2), and the
// v3.0 Home, Teach and Science. Its systems are hidden until the release gate (H-1), so Home and
// Teach offer the lesson only in a `?preview=1` session today; a plain visit is v2.1's. The bar:
// five pauses, Next / Back and a clicker's Page Down / Page Up, each pause lighting its system at
// its time on its graph, the next pause's pack fetched beforehand, the body ≥ 160 px with the bar at
// 360×640 in English and the +40 % pseudo-locale. Projects desktop, projector and phone.
// E2E_SHOTS=1 saves pictures to .shots/ (git-ignored).

test.beforeEach(({ page }) => returningVisitor(page))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/x1-${name}-${test.info().project.name}.png` })
}

/** Minutes after eating, from the dock's slider. */
const now = async (page: Page) => Number(await page.getByRole('slider', { name: 'Timeline' }).getAttribute('aria-valuenow'))
const bar = (page: Page) => page.locator('[data-lesson-bar]')
/** Where the graphs show one at a time (projector, phone), the one in front. */
const front = (page: Page, name: string) => page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name, pressed: true })
const tabbed = () => test.info().project.name !== 'desktop'

/** The pauses with skin public or in a preview (pause 4 is skin's: R34). */
const PAUSES = [
  { step: 1, pause: 'stomach', system: 'digestion', t: 30, graph: 'Stomach', question: 'Where is the roti now?' },
  { step: 2, pause: 'blood', system: 'circulation', t: 51, graph: 'Where blood goes', question: 'Where is more blood going?' },
  { step: 3, pause: 'breaths', system: 'breathing', t: 70, graph: 'Breaths a minute', question: 'Why are breaths faster now?' },
  { step: 4, pause: 'sweat', system: 'skin', t: 75, graph: 'Sweat made', question: 'Where does the extra heat go?' },
  { step: 5, pause: 'water', system: 'kidneys', t: 111, graph: 'Urine made per hour', question: 'Where did the water go?' },
] as const

async function expectPause(page: Page, p: (typeof PAUSES)[number]) {
  await expect(bar(page)).toHaveAttribute('data-lesson-step', String(p.step))
  await expect(bar(page)).toHaveAttribute('data-lesson-pause', p.pause)
  await expect(page.locator(`[data-system-title="${p.system}"]`)).toBeAttached()
  await expect.poll(() => now(page)).toBe(p.t)
  await expect(bar(page).getByRole('status')).toContainText(p.question)
  if (tabbed()) await expect(front(page, p.graph)).toBeVisible()
}

test('a plain visit is v2.1’s: no lesson card on Home or Teach, no systems list, one Science section', async ({ page }) => {
  await goto(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Home's v3.0 parts load after its first paint; with only Digestion public they show nothing.
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-flagship]')).toHaveCount(0)
  await expect(page.locator('[data-systems]')).toHaveCount(0)
  await goto(page, '/teach')
  await expect(page.locator('[data-flagship]')).toHaveCount(0)
  await expect(page.locator('[data-chapter]')).toHaveCount(1)
  await expect(page.locator('[data-chapter="nutrition"] [data-lesson]')).toHaveCount(3)
  await goto(page, '/science')
  await expect(page.locator('section[data-system]')).toHaveCount(1)
  await expect(page.locator('section[data-system="digestion"] li').first()).toBeVisible()
})

test('Home in a preview: the lesson is the first call to action, then a static list of the systems', async ({ page }) => {
  await goto(page, '/?preview=1')
  const card = page.locator('[data-flagship]')
  await expect(card).toBeVisible()
  await expect(card).toContainText('One roti, one walk: what does every system do?')
  // First: before the simulator's own link.
  const [cardTop, simTop] = await Promise.all([
    card.evaluate((e) => e.getBoundingClientRect().top),
    page.getByRole('link', { name: 'Open the simulator' }).evaluate((e) => e.getBoundingClientRect().top),
  ])
  expect(cardTop).toBeLessThan(simTop)
  const systems = page.locator('[data-systems] [data-system]')
  await expect(systems).toHaveCount(8)
  await expect(systems.first()).toContainText('Digestion')
  await shot(page, 'home')
  if (test.info().project.name === 'desktop') await checkAxe(page)
  // It opens the stage with the bar at its first pause; the address is a plain link (no lesson parameter).
  await card.click()
  await expect(bar(page)).toBeVisible()
  await expectPause(page, PAUSES[0])
  expect(new URL(page.url()).searchParams.has('lesson')).toBe(false)
})

test('the lesson: five pauses with Next, Back and the clicker, each pack fetched before its pause, then Finish', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => asked.push(new URL(r.url()).pathname))
  await goto(page, '/teach?preview=1')
  const start = page.locator('[data-flagship]').getByRole('link', { name: 'Start the guided lesson' })
  await expect(start).toBeVisible()
  await start.click()
  await expect(bar(page)).toBeVisible()
  await expectPause(page, PAUSES[0])
  await shot(page, 'pause1')
  // The packs of the pauses ahead are fetched before Next is pressed (Heart & blood's, from pause 1).
  const packsSoFar = () => asked.filter((p) => /\/assets\/pack-[\w-]+\.js$/.test(p)).length
  await expect.poll(packsSoFar).toBeGreaterThanOrEqual(1)
  const next = bar(page).locator('[data-lesson-next]')
  await next.click()
  await expectPause(page, PAUSES[1])
  await shot(page, 'pause2')
  // The clicker: Page Down is Next, Page Up is Back, while the bar is up.
  await page.locator('body').press('PageDown')
  await expectPause(page, PAUSES[2])
  await page.locator('body').press('PageUp')
  await expectPause(page, PAUSES[1])
  await page.locator('body').press('PageDown')
  await expectPause(page, PAUSES[2])
  await shot(page, 'pause3')
  await next.click()
  await expectPause(page, PAUSES[3])
  await shot(page, 'pause4')
  await page.locator('body').press('PageDown')
  await expectPause(page, PAUSES[4])
  await shot(page, 'pause5')
  // Each pack the lesson lit was fetched before its pause was shown: one per system besides digestion's.
  expect(packsSoFar()).toBeGreaterThanOrEqual(4)
  // Play and scrub still work during the lesson.
  await page.getByRole('slider', { name: 'Timeline' }).press('ArrowRight')
  await expect.poll(() => now(page)).toBe(PAUSES[4].t + 10)
  // The last Next is Finish: the Now line comes back.
  await expect(next).toHaveAccessibleName('Finish')
  await next.click()
  await expect(bar(page)).toHaveCount(0)
})

test('on a phone the bar is one line, and "?" opens the question, the book’s line and the model’s', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'phone only')
  await goto(page, '/?preview=1')
  await page.locator('[data-flagship]').click()
  await expect(bar(page)).toBeVisible()
  const height = await bar(page).evaluate((e) => e.getBoundingClientRect().height)
  expect(height).toBeLessThanOrEqual(52)
  await bar(page).getByRole('button', { name: 'Question and answer' }).click()
  const sheet = page.getByRole('dialog', { name: 'Step 1 of 5' })
  await expect(sheet).toContainText('Where is the roti now?')
  await expect(sheet).toContainText('The book says: NCERT Class 10')
  await expect(sheet).toContainText('This model says: The roti leaves the stomach')
  await shot(page, 'phone-sheet')
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
})

for (const lang of ['en', 'pseudo'] as const)
  test(`the body keeps ≥ 160 px with the bar at 360×640 (${lang})`, async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'phone only')
    await page.setViewportSize({ width: 360, height: 640 })
    await goto(page, `/?preview=1${lang === 'pseudo' ? '&lang=pseudo' : ''}`)
    await expect(page.locator('html')).toHaveAttribute('lang', lang === 'pseudo' ? 'en-XA' : 'en')
    await page.locator('[data-flagship]').click()
    await expect(bar(page)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', lang === 'pseudo' ? 'en-XA' : 'en')
    for (const p of PAUSES) {
      await expect(bar(page)).toHaveAttribute('data-lesson-step', String(p.step))
      await expect(page.locator(`[data-system-title="${p.system}"]`)).toBeAttached()
      const body = await measureBody(page)
      expect(body.visibleHeight, `pause ${p.step}`).toBeGreaterThanOrEqual(160)
      if (p.step < 5) await bar(page).locator('[data-lesson-next]').click()
    }
    await shot(page, `body-360-${lang}`)
  })

test('Teach in a preview: the lesson on top, then the lessons by NCERT chapter, each with its classes', async ({ page }) => {
  await goto(page, '/teach?preview=1')
  await expect(page.locator('[data-flagship]')).toBeVisible()
  await expect(page.locator('[data-chapter]')).toHaveCount(5)
  await expect(page.locator('[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')))).resolves.toEqual([
    'nutrition',
    'respiration',
    'transport',
    'excretion',
    'movement',
  ])
  await expect(page.getByText('Class 10 · Life Processes')).toBeVisible()
  const breath = page.locator('[data-lesson="breathRun"]')
  await expect(breath).toContainText('Why do you breathe faster when you run?')
  await expect(breath).toContainText('Class 6 · Class 7 · Class 10')
  await expect(breath).toHaveAttribute('data-release', 'v3.0')
  await shot(page, 'teach')
  if (test.info().project.name === 'desktop') await checkAxe(page)
  // A system's lesson opens on its system and graph, in a preview link.
  await page.locator('[data-lesson="heartWalk"] a').click()
  await expect(page.locator('[data-system-title="circulation"]')).toBeAttached()
  await expect.poll(() => now(page)).toBe(70)
  if (tabbed()) await expect(front(page, 'Where blood goes')).toBeVisible()
})

test('Science in a preview: one section per system, each with the sources its rows cite', async ({ page }) => {
  await goto(page, '/science?preview=1')
  const sections = page.locator('section[data-system]')
  await expect(sections).toHaveCount(8)
  await expect(page.locator('section[data-system="breathing"] li')).toHaveCount(7)
  await expect(page.locator('section[data-system="lymph"]')).toContainText('Drawing only')
  // Each source links to its entry in the reference list.
  const href = await page.locator('section[data-system="kidneys"] a').first().getAttribute('href')
  expect(href).toMatch(/^#/)
  await expect(page.locator(`[id="${href!.slice(1)}"]`)).toBeAttached()
  await shot(page, 'science')
})
