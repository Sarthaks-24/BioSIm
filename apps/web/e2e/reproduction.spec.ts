import { expect, test, type Page } from '@playwright/test'
import { checkAxe, goto, returningVisitor } from './helpers/gate.ts'

// Reproduction (R-1, v3.2): a row behind the teacher switch "Growing up", off by default, for this tab
// only. Hidden (`public: false`) until the user flips it, so these tests use a `?preview=1` session.
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

  // A plain session (no preview) does not even list the switch while the row is hidden.
  await goto(page, '/sim?v=3&a=roti:1')
  const { sheet, toggle } = await growingUpSwitch(page)
  await expect(sheet.getByRole('switch').first()).toBeVisible()
  await expect(toggle).toHaveCount(0)
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
