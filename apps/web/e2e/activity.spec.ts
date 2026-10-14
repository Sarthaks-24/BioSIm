import { expect, test, type Page } from '@playwright/test'
import { goto, linkRoundTripProblems, onlyIn, returningVisitor, showChip } from './helpers/gate.ts'

// E-3b-ui: activity input (ui-ux §5). The meal sheet's "Food | Activity" switch, its ready plans
// and "Make your own"; bout chips (FP-1's chip, kind="bout", and the shared "+n"); a hatched
// column on every graph, a bar on the dock's track, start and end moments; Keep keeps the bouts;
// links carry `act` and `bact`. Projects: desktop and phone.

test.beforeEach(async ({ page }) => {
  onlyIn('desktop', 'phone')
  await returningVisitor(page)
})

async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await page.waitForLoadState('networkidle')
}
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key)
const boutChip = (page: Page, name: RegExp) => page.getByRole('button', { name: new RegExp(`^Change ${name.source}`) })

/** "+" then the Activity tab; its code loads now, the first time. */
async function openActivity(page: Page) {
  await page.getByRole('button', { name: 'Add food' }).filter({ visible: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(page.locator('[data-activity-sheet]')).toBeVisible()
}

test('a ready plan adds a bout: its chip, a band on the graph, a bar on the track, its moments', async ({ page }) => {
  await open(page, '/sim?v=3&a=cola:1')
  await openActivity(page)
  await page.getByRole('button', { name: 'Walk 20 min, from 0:30' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await showChip(page, /^Change Walk 20 min, from 0:30/)
  // No kcal on a bout chip (ui-ux §2.1).
  await expect(page.locator('[data-chip="bout"]').first()).not.toContainText('kcal')
  await expect.poll(() => param(page, 'act')).toBe('walk.30.20')
  await expect(page.locator('[data-bout="run"]').first()).toBeAttached()
  await expect(page.locator('[data-bout-bar="run"]')).toHaveCount(1)
  // Its start and end are moments: Page Down from the start goes to the next one (here 0:30 or earlier).
  await expect(page.locator('[data-moment~="event.activityStart"]')).toHaveCount(1)
  await expect(page.locator('[data-moment~="event.activityEnd"]')).toHaveCount(1)
})

test('a bout chip edits its bout; ✕ removes it; a blocked choice says why', async ({ page }) => {
  await open(page, '/sim?v=3&a=cola:1&act=walk.30.20')
  await showChip(page, /^Change Walk 20 min, from 0:30/)
  await boutChip(page, /Walk 20 min, from 0:30/).click()
  const sheet = page.locator('[data-activity-sheet]')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Run', exact: true }).click()
  await sheet.getByRole('button', { name: '10 min', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => param(page, 'act')).toBe('run.30.10')

  // Overlap: a walk from 0:30 over the run says why and adds nothing.
  await openActivity(page)
  await sheet.locator('[data-put]').click()
  await expect(sheet.getByRole('alert')).toContainText('overlaps Run 10 min, from 0:30')
  await page.keyboard.press('Escape')
  expect(param(page, 'act')).toBe('run.30.10')

  // ✕ on the chip removes it: resting again.
  await showChip(page, /^Change Run 10 min, from 0:30/)
  await page.getByRole('button', { name: 'Remove Run 10 min, from 0:30' }).click()
  await expect.poll(() => param(page, 'act')).toBeNull()
  await expect(page.locator('[data-chip="bout"]')).toHaveCount(0)
})

test('at most 3 bouts from the sheet', async ({ page }) => {
  await open(page, '/sim?v=3&a=cola:1&act=walk.0.5,walk.60.5,walk.120.5')
  await openActivity(page)
  await page.getByRole('button', { name: 'Run 10 min, from 0:30' }).click()
  await expect(page.locator('[data-activity-sheet]').getByRole('alert')).toContainText('At most 3')
})

test('a link with act and bact opens with its bouts and writes them back; Keep keeps the bouts', async ({ page }) => {
  const url = '/sim?v=3&a=cola:1&b=cola:1&t=40&act=walk.30.20,run.120.10&bact=walk.120.20'
  expect(await linkRoundTripProblems(page, url)).toEqual([])
  expect(param(page, 'act')).toBe('walk.30.20,run.120.10')
  expect(param(page, 'bact')).toBe('walk.120.20')
  await expect(page.locator('[data-chip="bout"]')).toHaveCount(2)
  await expect(page.locator('[data-kept-tag]')).toContainText('Kept: Cola + walk 20 min, from 2:00')
  await expect(page.locator('[data-bout="kept"]').first()).toBeAttached()

  // Keep: the meal and its bouts become the kept run.
  await open(page, '/sim?v=3&a=roti:1&act=run.30.10')
  const keep = page.getByRole('button', { name: 'Keep to compare' })
  if (!(await keep.isVisible())) await page.getByRole('button', { name: 'More actions' }).click()
  await keep.click()
  await expect.poll(() => param(page, 'bact')).toBe('run.30.10')
  expect(param(page, 'b')).toBe('roti:1')
})

test('a walk alone: the clock says "from the start", and Keep keeps it', async ({ page }) => {
  await open(page, '/sim?v=3&a=')
  await page.locator('[data-try-bout]').click()
  await expect.poll(() => param(page, 'act')).toBe('walk.30.20')
  await expect(page.locator('[data-dock]')).toContainText('from the start')
  await page.keyboard.press('p')
  await expect.poll(() => param(page, 'bact')).toBe('walk.30.20')
})

test('the body’s band follows the clock (A-0 reads it)', async ({ page }) => {
  await open(page, '/sim?v=3&a=cola:1&act=run.30.10&t=35')
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'run')
  await open(page, '/sim?v=3&a=cola:1&act=run.30.10&t=60')
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'rest')
})

test('bouts add no stage row: the body and the dock keep their size', async ({ page }) => {
  const sizes = async (url: string) => {
    await open(page, url)
    await page.waitForTimeout(300)
    return page.evaluate(() =>
      ['[data-activity-band]', '[data-dock]'].map((s) => Math.round(document.querySelector(s)!.getBoundingClientRect().height)),
    )
  }
  const without = await sizes('/sim?v=3&a=cola:1&t=40')
  const withBouts = await sizes('/sim?v=3&a=cola:1&t=40&act=walk.30.20,run.120.10,walkBrisk.240.30')
  expect(withBouts).toEqual(without)
})

test('6 foods and 3 bouts: every chip shown or counted in "+n", on one row (EN and +40 % pseudo-locale)', async ({ page }) => {
  onlyIn('desktop')
  const url = '/sim?v=3&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1&act=walkBrisk.330.60,walk.30.20,run.120.10'
  for (const lang of ['', '&lang=pseudo']) {
    for (const w of [1440, 360, 320]) {
      await page.setViewportSize({ width: w, height: w > 400 ? 900 : 640 })
      await open(page, url + lang)
      const bar = page.locator('section[aria-labelledby="meal-bar-title"]')
      const chips = await bar.locator('ul > li').evaluateAll((els) => {
        const strip = els[0]?.parentElement?.getBoundingClientRect()
        return els.map((e) => {
          const r = e.getBoundingClientRect()
          return { shown: !!strip && r.width > 0 && r.left >= strip.left - 1 && r.right <= strip.right + 1, top: Math.round(r.top) }
        })
      })
      const plus = await bar
        .getByText(/^\+\d+$/)
        .filter({ visible: true })
        .allTextContents()
      const counted = plus.length ? Number(plus[0]!.slice(1)) : 0
      const where = `${w} px${lang}`
      expect(chips.length, where).toBe(9)
      expect(chips.filter((c) => c.shown).length + counted, where).toBe(9)
      expect(new Set(chips.filter((c) => c.shown).map((c) => c.top)).size, where).toBe(1)
    }
  }
})
