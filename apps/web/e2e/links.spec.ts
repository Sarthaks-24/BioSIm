import { expect, test, type Page } from '@playwright/test'
import { linkRoundTripProblems, onlyIn, openMealActions, returningVisitor, showChip } from './helpers/gate.ts'

// FP-6 (T8): Back, share, links. Bugs B6 (Back left the app with a sheet open), B11 (no share on
// phones and tablets), B21 (links changed silently), B22 (`lang=en` on every link).
// Projects: phone (Chromium) and webkit-phone (E2E_ENGINES=1) for Back; phone for sharing at
// phone and tablet widths; desktop for the bar's "Copy link" (R60), `lang` and the notes. The
// newer-version link ("Update now", offline) is in offline.spec.ts: it needs the service worker.

test.beforeEach(async ({ page }) => returningVisitor(page))

/** The stage has opened its link and written it back. */
async function open(page: Page, url: string) {
  // WebKit: a page that has just loaded may still start a navigation of its own (seen on Home).
  await page.goto(url).catch((e: Error) => (/interrupted/.test(e.message) ? page.goto(url) : Promise.reject(e)))
  if (url.startsWith('/sim')) await page.locator('[data-stage]').waitFor()
  await page.waitForLoadState('networkidle')
}
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key)

test.describe('Back', () => {
  test.beforeEach(() => onlyIn('phone', 'webkit-phone'))

  test('Back closes a sheet and stays on the stage, with the same meal (B6)', async ({ page }) => {
    // The reader came from Home, then pasted a link.
    await open(page, '/')
    await open(page, '/sim?v=3&a=cola:1')
    for (const [button, sheet] of [
      ['Add food', 'Add food'],
      ['Settings', 'Settings'],
    ] as const) {
      await page.getByRole('button', { name: button }).filter({ visible: true }).first().click()
      await expect(page.getByRole('dialog', { name: sheet })).toBeVisible()
      await page.goBack()
      await expect(page.getByRole('dialog', { name: sheet })).toBeHidden()
      expect(new URL(page.url()).pathname, `Back with "${sheet}" open stays on the stage`).toBe('/sim')
      expect(param(page, 'a')).toBe('cola:1')
      // Forward does not open it again, nor change the meal.
      await page.goForward()
      await page.waitForTimeout(300)
      await expect(page.getByRole('dialog', { name: sheet })).toBeHidden()
      expect(param(page, 'a')).toBe('cola:1')
      await page.goBack()
      await page.waitForTimeout(300)
    }
    // A sheet closed on the page takes its entry with it: Back goes where it went before.
    await page.getByRole('button', { name: 'Add food' }).click()
    await page.getByRole('dialog', { name: 'Add food' }).getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog', { name: 'Add food' })).toBeHidden()
    await page.waitForTimeout(300)
    expect(new URL(page.url()).pathname).toBe('/sim')
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
  })

  test('a pasted link, a food added, then Back and Forward: the food stays (Back never undoes a meal)', async ({ page }) => {
    await open(page, '/')
    await open(page, '/sim?v=3&a=cola:1')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await sheet.getByRole('combobox').fill('fries')
    await sheet.getByRole('combobox').press('Enter')
    await expect(sheet).toBeHidden()
    // Closing took the sheet's entry off; the entry under it held the pasted link, without fries.
    await page.waitForTimeout(500)
    expect(new URL(page.url()).pathname).toBe('/sim')
    expect(param(page, 'a'), 'the food is still in the link').toBe('cola:1,fries:1')
    await showChip(page, /^French fries, Servings 1$/)
    // Forward steps onto the sheet's old entry (it held the link while the sheet was open), and
    // Back again: the sheet stays shut, and the food stays.
    for (const step of ['forward', 'back'] as const) {
      await (step === 'forward' ? page.goForward() : page.goBack())
      await page.waitForTimeout(500)
      expect(new URL(page.url()).pathname).toBe('/sim')
      expect(param(page, 'a'), `${step}: the old meal does not come back`).toBe('cola:1,fries:1')
      await expect(sheet).toBeHidden()
    }
    await showChip(page, /^French fries, Servings 1$/)
  })
})

test.describe('share on a phone and a tablet (B11)', () => {
  test.beforeEach(() => onlyIn('phone'))

  for (const [w, h] of [
    [360, 640],
    [768, 1024],
    [800, 1280],
  ] as const) {
    test(`"⋯" has Copy link or Share at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await open(page, '/sim?v=3&a=cola:1')
      await openMealActions(page)
      await expect(page.getByRole('button', { name: /^(Copy link|Share)$/ }).filter({ visible: true })).toHaveCount(1)
    })
  }

  test('copying blocked: the link shows, selected, to copy by hand', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    // A school browser: no share sheet, and the clipboard refuses.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined })
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } })
    })
    await open(page, '/sim?v=3&a=cola:1')
    await openMealActions(page)
    await page.getByRole('button', { name: 'Copy link' }).click()
    const field = page.getByRole('textbox', { name: 'Copy this link' })
    await expect(field).toBeVisible()
    await expect(field).toHaveValue(page.url())
    expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, page.url().length])
  })
})

test.describe('the bar’s Copy link on a desktop (R60)', () => {
  test.beforeEach(() => onlyIn('desktop'))

  test('one click copies the link, at 1440 and 1024 px', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 800 })
      await open(page, '/sim?v=3&a=cola:1&t=30')
      const copy = page.getByRole('button', { name: 'Copy link' })
      await expect(copy).toBeVisible()
      await copy.click()
      await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
    }
  })

  test('copying blocked: "⋯" opens with the link, selected', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }),
    )
    await open(page, '/sim?v=3&a=cola:1')
    await page.getByRole('button', { name: 'Copy link' }).click()
    const field = page.getByRole('textbox', { name: 'Copy this link' })
    await expect(field).toBeVisible()
    await expect(field).toBeFocused()
    await expect(field).toHaveValue(page.url())
  })
})

test.describe('links', () => {
  test.beforeEach(() => onlyIn('desktop'))

  test('lang is written only when the link had it or the reader chose it (B22)', async ({ page }) => {
    for (const [link, lang] of [
      ['/sim?v=3&a=cola:1', null],
      ['/sim', null],
      ['/sim?v=3&a=cola:1&lang=en', 'en'],
      // A Hindi lesson's link keeps its Hindi.
      ['/sim?v=3&a=cola:1&lang=hi', 'hi'],
    ] as const) {
      await open(page, link)
      await page.waitForTimeout(500)
      expect(param(page, 'lang'), link).toBe(lang)
    }
    // Choosing a language on the stage writes it (a Hindi build has the button).
    await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'en'))
    await open(page, '/sim?v=3&a=cola:1')
    const toHindi = page.getByRole('button', { name: /Switch to Hindi/ }).filter({ visible: true })
    test.skip(!(await toHindi.count()), 'Hindi is paused (R47): this build has no language switch')
    await toHindi.first().click()
    await expect.poll(() => param(page, 'lang')).toBe('hi')
  })

  test('a link changed on load says so, plainly (B21)', async ({ page }) => {
    const notes = page.locator('[data-stage] [role="note"]')
    await linkRoundTripProblems(page, '/sim?v=3&a=cola:999')
    await expect(notes.filter({ hasText: 'This link asked for Cola ×999; showing ×5' })).toHaveCount(1)
    await linkRoundTripProblems(page, '/sim?v=3&a=water:1,milk:1,roti:1,dal:1,apple:1,banana:1,cola:1,fries:1')
    await expect(notes.filter({ hasText: 'A meal can have at most 6 foods' })).toContainText('Cola, French fries')
    await linkRoundTripProblems(page, '/sim?v=3&a=cola:1&t=99999')
    await expect(notes.filter({ hasText: 'past the end' })).toHaveCount(1)
    await linkRoundTripProblems(page, '/sim?v=3&a=cola:1&layer=lungs')
    await expect(notes.filter({ hasText: '“lungs”' })).toHaveCount(1)
    // A link shown as written has no note.
    await linkRoundTripProblems(page, '/sim?v=3&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1&t=90')
    await page.waitForTimeout(300)
    await expect(notes).toHaveCount(0)
  })

  test('fuzz: every link that comes back changed has a note (B21)', async ({ page }) => {
    test.slow()
    // A few dozen links from odd parts (the codec's own fuzz, packages/engine/test/share.test.ts, runs thousands).
    const parts = {
      // Defaults (who=adult-ref, layer=digestion) and a food listed twice are written back shorter: no change.
      a: ['cola:1', 'cola:999', 'milk:0.3', 'COLA:1', 'nope:1', 'fries:2', 'roti:1,dal:1,milk:1,apple:1,banana:1,idli:1,fries:1'],
      t: ['', '60', '-5', 'abc', '99999'],
      who: ['', 'teen-ref'],
      layer: ['', 'circulation', 'lungs', '<x>'],
      act: ['', 'walk.120.20'],
    }
    let seed = 7
    const pick = <T>(xs: readonly T[]) => xs[((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * xs.length))]!
    const problems: string[] = []
    for (let i = 0; i < 12; i++) {
      const q = new URLSearchParams({ v: '3' })
      for (const [k, values] of Object.entries(parts)) {
        const value = pick(values)
        if (value) q.set(k, value)
      }
      const link = `/sim?${q}`
      const changed = (await linkRoundTripProblems(page, link)).filter((c) => !c.startsWith('lang='))
      const notes = await page.locator('[data-stage] [role="note"]').count()
      if (changed.length && !notes) problems.push(`${link}: ${changed.join('; ')}, and no note says so`)
    }
    expect(problems).toEqual([])
  })
})
