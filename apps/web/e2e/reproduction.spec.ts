import { expect, test, type Page } from '@playwright/test'
import { checkAxe, goto, returningVisitor } from './helpers/gate.ts'

// Reproduction (R-1, v3.2): a row behind the teacher switch "Growing up", off by default, for this tab
// only. Public since R117, so the switch is its only gate; most tests also carry `?preview=1`, which changes nothing for it.
// Off: no row anywhere (picker, Home, Science, a link). On (Settings): the last picker row, with
// "Teacher switch: on"; lit, two panels in the graph column (hormones over one cycle, relative, Model
// estimate; the book's height table and its worked example) and nothing drawn on the body; no field
// to type into. Off again while lit: back to Digestion. Projects desktop and phone.
// E2E_SHOTS=1 saves pictures to .shots/ (git-ignored).

const LINK = '/sim?v=3&a=roti:1&layer=reproduction&preview=1'

test.beforeEach(({ page }) => returningVisitor(page))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/r1-repro-${name}-${test.info().project.name}.png` })
}

/** Opens the settings sheet and returns the Growing up switch (or its locator, when it is not there). */
async function growingUpSwitch(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(sheet).toBeVisible()
  return { sheet, toggle: sheet.getByRole('switch', { name: 'Growing up (Classes 8 to 10)' }) }
}

/** The picker's rows. */
async function pickerRows(page: Page) {
  await page.getByRole('button', { name: /^Body system: / }).click()
  const picker = page.getByRole('dialog', { name: 'Body systems' })
  await expect(picker).toBeVisible()
  return picker
}

test('off by default: no row in the picker, on Home or Science, and a link to it opens Digestion', async ({ page }) => {
  await goto(page, LINK)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(page.locator('[data-card="reproduction"]')).toHaveCount(0)
  const picker = await pickerRows(page)
  await expect(picker.locator('[data-system-row]').first()).toBeVisible()
  await expect(picker.locator('[data-system-row="reproduction"]')).toHaveCount(0)
  await expect(picker).not.toContainText('Growing up')
  await page.keyboard.press('Escape')

  await goto(page, '/?preview=1')
  await expect(page.getByRole('heading', { name: 'Body systems' })).toBeVisible()
  await expect(page.locator('main')).not.toContainText('Reproduction')
  await goto(page, '/science?preview=1')
  await expect(page.locator('[data-system="breathing"]')).toBeVisible()
  await expect(page.locator('[data-system="reproduction"]')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('Anckaert')
  await expect(page.locator('main')).not.toContainText('menstrual')

  // A plain session (no preview) lists the switch, off.
  await goto(page, '/sim?v=3&a=roti:1')
  const { toggle } = await growingUpSwitch(page)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
})

test('switched on without ?preview=1 (R117): the row shows in the picker and a plain link opens it', async ({ page }) => {
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  const { toggle } = await growingUpSwitch(page)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  const picker = await pickerRows(page)
  await expect(picker.locator('[data-system-row]').last()).toHaveAttribute('data-system-row', 'reproduction')
  await page.keyboard.press('Escape')
  await goto(page, '/sim?v=3&a=roti:1&layer=reproduction')
  await expect(page.locator('[data-card="reproduction"]')).toBeVisible()
  await expect(page.locator('[data-system-title="reproduction"]')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('preview')).toBeNull()
})

test('switched on: the last row, two panels beside the body (never on it), no input; Home and Science list it; off again goes back', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await goto(page, '/sim?v=3&a=roti:1&preview=1')
  await page.locator('[data-stage]').waitFor()
  const { toggle } = await growingUpSwitch(page)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => sessionStorage.getItem('lifepeek:growingUp'))).toBe('1')
  // Per tab, never per device.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /growing/i.test(k)))).toEqual([])
  await page.keyboard.press('Escape')

  // The picker's last group, saying the switch is on; picking it lights the row.
  const picker = await pickerRows(page)
  await expect(picker.locator('[data-system-row]').last()).toHaveAttribute('data-system-row', 'reproduction')
  await expect(picker.getByRole('region', { name: 'Growing up' })).toContainText('Teacher switch: on')
  await picker.locator('[data-system-row="reproduction"]').click()
  await expect(picker).toBeHidden()
  const card = page.locator('[data-card="reproduction"]')
  await expect(card).toBeVisible()
  await expect(page.locator('[data-system-title="reproduction"]')).toBeVisible()

  // Nothing on the body: the plain flat body, no layer, no organ labels; the Now line says why.
  await expect(page.locator('[data-body="flat"][data-framing="full"]')).toBeVisible()
  await expect(page.locator('[data-layer]')).toHaveCount(0)
  await expect(page.locator('[data-callout]')).toHaveCount(0)
  const now = page.locator('[data-now="reproduction"]').filter({ visible: true })
  await expect(now).toContainText('Model estimate')
  await expect(now).toContainText('nothing is drawn on the body')

  // The hormone panel: three lines on a relative scale, the book's day 14 and its 21–35 days.
  const chart = card.getByRole('img', { name: /Hormones over one cycle/ })
  await expect(chart).toBeVisible()
  await expect(card.locator('[data-line]')).toHaveCount(3)
  await expect(card.locator('[data-status="assumption"]')).toHaveText('Model estimate')
  await expect(card).toContainText('Cycles differ: NCERT Class 9 says 21–35 days, often about 28.')
  await expect(card).toContainText('Day 14: an egg is released (ovulation)')
  await card.getByText('As a table').click()
  await expect(card.locator('[data-phase="ovulation"]')).toContainText('Around day 14')
  await expect(card.locator('[data-phase="ovulation"] td').nth(1)).toHaveText('100 %')
  await shot(page, 'cycle')
  await checkAxe(page)

  // The height panel: the book's table and worked example, no box for anyone's height.
  await card.getByRole('button', { name: 'How height grows' }).click()
  await expect(card.locator('[data-height-table] tbody tr')).toHaveCount(11)
  await expect(card.locator('[data-age="11"]')).toContainText('81 %')
  await expect(card.locator('[data-age="11"]')).toContainText('88 %')
  await expect(card.locator('[data-example]')).toHaveAttribute('data-age', '9')
  await expect(card.locator('[data-example-text]')).toContainText('120 × 100 ÷ 75 = 160 cm')
  await expect(card.locator('input, textarea, select, [contenteditable]')).toHaveCount(0)
  await shot(page, 'height')
  await checkAxe(page)

  // Home and Science list it while the switch is on (this tab).
  await goto(page, '/?preview=1')
  await expect(page.locator('main')).toContainText('Two book panels: hormones over one cycle, and how height grows.')
  await goto(page, '/science?preview=1')
  const section = page.locator('[data-system="reproduction"]')
  await expect(section).toBeVisible()
  await expect(section).toContainText('Anckaert E')
  await expect(page.locator('#anckaert2021')).toBeAttached()

  // A link to it opens it in this tab; switched off while lit, the stage goes back to Digestion.
  await goto(page, LINK)
  await expect(page.locator('[data-card="reproduction"]')).toBeVisible()
  const again = await growingUpSwitch(page)
  await again.toggle.click()
  await expect(again.toggle).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(page.locator('[data-card="reproduction"]')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('lifepeek:growingUp'))).toBeNull()
  expect(errors).toEqual([])
})

test('Teach (v3.2 Teach step, R117): off, no chapter and no worksheet; on, its lesson under its own chapter, its worksheet, and the panel with its "Why different?" card', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  test.setTimeout(60_000)
  // Off (the default): no chapter, and its worksheet's address shows Teach.
  await goto(page, '/teach')
  await expect(page.locator('[data-chapter="respiration"]')).toBeVisible()
  await expect(page.locator('[data-chapter="reproduction"]')).toHaveCount(0)
  await expect(page.locator('[data-lesson="cycleHormones"]')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('uterus')
  await goto(page, '/teach?sheet=cycleHormones')
  await expect(page.locator('[data-worksheet]')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Using LifePeek in class' })).toBeVisible()

  // A teacher switches it on in Settings (this tab only).
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  const { sheet: settings, toggle } = await growingUpSwitch(page)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  // The sheet closes by going Back in history: wait for it, or that Back can land after the next page load.
  await expect(settings).toBeHidden()
  // The switch rewrites the link in its canonical form (FIX-F2: useLinkSync hears it), `:` written as %3A.
  await expect(page).toHaveURL(/\/sim\?v=3&a=roti(:|%3A)1$/)

  await goto(page, '/teach')
  const chapter = page.locator('[data-chapter="reproduction"]')
  await expect(chapter.getByRole('heading', { name: 'Reproduction and growing up' })).toBeVisible()
  // After Control and coordination (Class 10's next chapter), before moving and body heat.
  await expect(page.locator('[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')))).resolves.toEqual([
    'nutrition',
    'respiration',
    'transport',
    'excretion',
    'control',
    'reproduction',
    'movement',
  ])
  const row = chapter.locator('[data-lesson="cycleHormones"]')
  await expect(row).toHaveAttribute('data-release', 'v3.2')
  await expect(row).toContainText('Why does the lining of the uterus build up every month?')
  await expect(row).toContainText('opens on the hormone panel')
  await expect(row).toContainText('Class 8 · Class 9 · Class 10')
  await checkAxe(page)

  // Its worksheet: the switch named, no box for anyone's own cycle; the answers are the book's and the panel's.
  await row.getByRole('link', { name: 'Worksheet to print: Why does the lining of the uterus build up every month?' }).click()
  const sheet = page.locator('[data-worksheet="cycleHormones"]')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('Class 8 · Class 9 · Class 10 — Reproduction and growing up')
  await expect(sheet).toContainText('“Growing up”')
  await expect(sheet.getByRole('img', { name: /against the days of one cycle, day 1 to day 28/ })).toBeVisible()
  await expect(sheet.locator('input, textarea, select')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Print with answers' }).check()
  await expect(sheet).toContainText('LH is highest on day 14')
  await expect(sheet).toContainText('not anyone’s own')

  // The lesson opens the panel, whose book line has its card.
  await goto(page, '/teach')
  await page.locator('[data-lesson="cycleHormones"] a').first().click()
  const card = page.locator('[data-card="reproduction"]')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Why different? ›' }).click()
  const why = card.locator('[data-why="sys.reproduction.why"]')
  await expect(why.locator('[data-why-row]')).toHaveCount(2)
  await expect(why.locator('[data-why-row="cycle"] [data-why-book]')).toContainText('(NCERT Class 9 Exploration, Ch 11, p. 221)')
  await expect(why.locator('[data-why-row="menstruation"] [data-why-book]')).toContainText('(NCERT Class 10, Ch 7, p. 124)')
  await expect(why).toContainText('In the exam, write the book’s value.')
  await checkAxe(page)
})

/** The files of a pack (pack-manifest.json), to slow or fail only those. */
async function packUrls(page: Page, id: string) {
  const manifest = (await (await page.request.get('/pack-manifest.json')).json()) as { entries: { id: string; urls: string[] }[] }
  return manifest.entries.find((e) => e.id === id)!.urls
}

/** Turns the Growing up switch on or off from the settings sheet, and closes it. */
async function setSwitch(page: Page, on: boolean) {
  const { sheet, toggle } = await growingUpSwitch(page)
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', String(on))
  await page.keyboard.press('Escape')
  // The sheet closes by going Back in history: wait for it, or that Back can land after the next navigation.
  await expect(sheet).toBeHidden()
}

const noReproduction = async (page: Page) => {
  expect(page.url()).not.toMatch(/reproduction/i)
  await expect(page.locator('[data-card="reproduction"]')).toHaveCount(0)
  await expect(page.locator('[data-system-title="reproduction"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/reproduction|growing up/i)
}

test('Teach follows the switch without a reload (FIX-F2 store, R117): on, its chapter; off again, gone', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'the header’s links, one project is enough')
  let loads = 0
  page.on('load', () => loads++)
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  const teach = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'For teachers' })
  const sim = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Simulator' })
  const chapter = page.locator('[data-chapter="reproduction"]')
  await setSwitch(page, true)
  await teach.click()
  await expect(chapter.getByRole('heading', { name: 'Reproduction and growing up' })).toBeVisible()
  await sim.click()
  await page.locator('[data-stage]').waitFor()
  await setSwitch(page, false)
  await teach.click()
  await expect(page.locator('[data-chapter="respiration"]')).toBeVisible()
  await expect(chapter).toHaveCount(0)
  await expect(page.locator('[data-lesson="cycleHormones"]')).toHaveCount(0)
  expect(loads, 'one page load: every change came from the store').toBe(1)
})

test('switched off while its pack is still on its way (R120 #3): nothing is lit when it arrives; the link never keeps it', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  test.setTimeout(60_000)
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  const urls = await packUrls(page, 'reproduction')
  await page.route(
    (url) => urls.includes(url.pathname),
    async (route) => {
      await new Promise((r) => setTimeout(r, 3000))
      return route.continue()
    },
  )
  await setSwitch(page, true)
  const picker = await pickerRows(page)
  await picker.locator('[data-system-row="reproduction"]').click()
  await expect(page.locator('[data-system-title] [role=status]')).toBeVisible()
  await setSwitch(page, false)
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(page.locator('[data-system-title] [role=status]')).toHaveCount(0)
  // Well after the pack has arrived: still Digestion, no row, no word of it, no layer in the link.
  await page.waitForTimeout(4000)
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await noReproduction(page)
})

test('a failed load, then the switch goes off (R120 #3, #12): Try again keeps the focus on the title; off, Digestion and no Try again', async ({
  page,
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  test.setTimeout(60_000)
  const urls = await packUrls(page, 'reproduction')
  // A fresh browser (no service worker: its cache would serve the files).
  const fresh = await browser.newContext({ serviceWorkers: 'block' })
  await fresh.addInitScript(() => {
    localStorage.setItem('lifepeek:medicalNoteSeen', '1')
    sessionStorage.setItem('lifepeek:growingUp', '1')
  })
  const failing = await fresh.newPage()
  await failing.route(
    (url) => urls.includes(url.pathname),
    (route) => route.abort(),
  )
  await goto(failing, '/sim?v=3&a=roti:1&layer=reproduction')
  await failing.locator('[data-stage]').waitFor()
  const status = failing.locator('[data-system-title] [role=status]')
  const retry = status.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible({ timeout: 15_000 })
  await retry.focus()
  await failing.keyboard.press('Enter')
  // The button goes away while the pack is asked for again: the title has the focus, and the status stays.
  await expect(failing.getByRole('button', { name: /^Body system: / })).toBeFocused()
  await expect(status).toBeVisible()
  await expect(retry).toBeVisible({ timeout: 15_000 })
  await setSwitch(failing, false)
  await expect(failing.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(status).toHaveCount(0)
  await noReproduction(failing)
  await fresh.close()
})

test('a link to it with the switch off never names it (R120 #5)', async ({ page }) => {
  await goto(page, '/sim?v=3&a=roti:1&layer=reproduction')
  await page.locator('[data-stage]').waitFor()
  await expect(page.getByText('This link’s body system isn’t available here, so it shows Digestion.').first()).toBeAttached()
  await noReproduction(page)
})

test('[ ] pressed quickly while packs load step on from the row on its way (R120 #6)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  await page.route('**/assets/pack-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 2000))
    return route.continue()
  })
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(']')
  await page.keyboard.press(']')
  await expect(page.locator('[data-system-title="circulation"]')).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('[')
  await page.keyboard.press('[')
  await page.keyboard.press('[')
  // Digestion, then round to the last row (skin, with the switch off).
  await expect(page.locator('[data-system-title="skin"]')).toBeVisible({ timeout: 15_000 })
})

test('the picker and the panels pass axe; a phone’s picker sheet is modal (R120 #19)', async ({ page }) => {
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  await setSwitch(page, true)
  const picker = await pickerRows(page)
  if (test.info().project.name === 'phone') await expect(picker).toHaveAttribute('aria-modal', 'true')
  else await expect(picker).not.toHaveAttribute('aria-modal', /.*/)
  // Each group is named once, by its heading's words.
  await expect(picker.getByRole('region', { name: 'Growing up', exact: true })).toBeVisible()
  await checkAxe(page)
  await picker.locator('[data-system-row="reproduction"]').click()
  const card = page.locator('[data-card="reproduction"]')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('tabindex', '0')
  await expect(card).toHaveAttribute('data-scroll', '')
  await checkAxe(page)
})

test('a switch that takes the focused Whole body button away puts focus on the title (R120 #19)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'the 3D view, one project is enough')
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  const whole = page.getByRole('button', { name: 'Whole body' })
  await expect(whole).toBeVisible({ timeout: 30_000 })
  await whole.focus()
  // [ from Digestion goes round to Skin, a flat-only row: the 3D view and its button go.
  await page.keyboard.press('[')
  await expect(page.locator('[data-system-title="skin"]')).toBeVisible({ timeout: 15_000 })
  await expect(whole).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Body system: Skin & temperature' })).toBeFocused()
})
