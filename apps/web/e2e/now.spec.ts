import { expect, test, type Page } from '@playwright/test'
import { expectInFirstScreen, onlyIn } from './helpers/gate.ts'

// WP-14 on /next: the dock's key moments, the Now line, the summary sentence and "Report a
// mistake" (council verdicts #3, #4, #6 and verification-council K2). Projects desktop (1440),
// projector (1280, projector mode) and phone (390).

const COLA_KEPT_BURGER = '/next?v=2&a=cola:1&b=cheeseburger:1,fries:1'
/** The address bar's query, decoded. */
const params = (page: Page) => new URL(page.url()).searchParams

test.beforeEach(async ({ page }) => {
  // A returning visitor: the first-run medical note is closed.
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
})

test.describe('timeline key moments', () => {
  test('clicking "half has left the stomach" moves the clock and the link’s t, and names it', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1')
    // Cola's "half has left" and "highest" nearly coincide: one marker names both (council round 2).
    const marker = page.getByRole('button', { name: /^Half the energy has left the stomach, \d+ min(;|$)/ })
    await marker.click()
    const slider = page.getByRole('slider').first()
    await expect(slider).not.toHaveAttribute('aria-valuenow', '0')
    const now = Number(await slider.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThan(15)
    expect(now).toBeLessThan(60)
    await expect.poll(() => Number(params(page).get('t'))).toBe(now)
    // While the clock is paused on it, its name shows above the bar.
    await expect(page.locator('[data-marker-tip] > span').first()).toHaveText(/^Half the energy has left the stomach, \d+ min$/)
  })

  test('the kept meal’s markers are hollow and drawn below the bar', async ({ page }) => {
    // Hollow rings below the bar; nearly coinciding moments share a marker (council round 2).
    await page.goto(COLA_KEPT_BURGER)
    const run = page.locator('[data-marker="run"] [data-dot]')
    const kept = page.locator('[data-marker="kept"] [data-dot]')
    await expect(kept.first()).toBeVisible()
    expect(await kept.count()).toBeGreaterThanOrEqual(2)
    const look = (dot: typeof run) =>
      dot.first().evaluate((el) => {
        const cs = getComputedStyle(el)
        return { fill: cs.backgroundColor, ring: cs.borderTopColor, y: el.getBoundingClientRect().y }
      })
    const [r, k] = [await look(run), await look(kept)]
    // Kept: shelf-coloured inside a grey ring (hollow). This meal: filled with its line's blue.
    expect(k.fill).not.toBe(r.fill)
    expect(k.fill).toBe(r.ring)
    expect(k.y).toBeGreaterThan(r.y)
    await expect(page.getByRole('button', { name: /^Kept: Half the energy has left the stomach, \d+ h/ })).toBeAttached()
    // Their targets meet, never overlap: this meal's end 8 px below the bar, the kept meal's start there.
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
    const runBox = await box('[data-marker="run"]')
    const keptBox = await box('[data-marker="kept"]')
    expect(keptBox.y).toBeGreaterThanOrEqual(runBox.y + runBox.height - 0.5)
  })

  test('the squeezed part of the bar says so (English and Hindi)', async ({ page }) => {
    onlyIn('desktop', 'projector')
    await page.goto('/next?v=2&a=cola:1')
    await expect(page.locator('[data-knee]')).toHaveText('6 h → 48 h squeezed')
    await page.goto('/next?v=2&a=cola:1&lang=hi')
    await expect(page.locator('[data-knee]')).toHaveText('6 घंटे → 48 घंटे सिकोड़ा गया')
    // Never runs off the bar's end.
    const knee = (await page.locator('[data-knee]').boundingBox())!
    const track = (await page.getByRole('slider').first().boundingBox())!
    expect(knee.x + knee.width).toBeLessThanOrEqual(track.x + track.width + 1)
  })
})

test.describe('the Now line', () => {
  test('follows the food: cola is in the stomach at 20 min and in the small intestine at 2 h', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&t=20')
    const now = page.locator('[data-now]')
    await expect(now).toHaveAttribute('data-now', 'stomach')
    await expect(now.getByRole('button', { name: 'Stomach: more about this stage' })).toBeVisible()
    await page.goto('/next?v=2&a=cola:1&t=120')
    await expect(now).toHaveAttribute('data-now', 'smallIntestine')
    await expect(now.getByRole('button', { name: 'Small intestine: more about this stage' })).toBeVisible()
  })

  // Council round 2, C1: where MOST of the meal is, from the model, worded for a drink.
  test('cola at 40 min: how much is still in the stomach and where the rest is, not "Stomach" alone', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&t=40')
    const line = page.locator('[data-now] > div:first-child > p:not([aria-hidden])')
    await expect(line).toHaveText(/^Where the meal is now: Stomach.*about half is here · some already in the small intestine/)
    // What the organ does, for a drink: no "chyme" (from 1024 px up, not on the projector).
    const job = page.locator('[data-now-job]')
    if (await job.isVisible()) await expect(job).toHaveText('the stomach lets the drink through a little at a time')
    await page.goto('/next?v=2&a=cola:1&t=0')
    await expect(line).toContainText('the drink is swallowed in a few gulps')
    await page.goto('/next?v=2&a=cheeseburger:1&t=0')
    await expect(line).toContainText('teeth grind food')
  })

  test('with a kept meal it also says where that meal is', async ({ page }) => {
    await page.goto(`${COLA_KEPT_BURGER}&t=40`)
    const kept = page.locator('[data-now-kept]')
    // The live words (the row also holds invisible copies of its longest versions, WP-18). A phone
    // shows "Kept:" where wider screens name the meal; screen readers hear the name everywhere.
    const words = kept.locator('> .grid > span:not([aria-hidden])')
    await expect(kept).toHaveAttribute('data-now-kept', 'stomach')
    if (test.info().project.name !== 'phone')
      await expect(words).toHaveText('Cheeseburger + French fries (kept): almost all in the stomach', { useInnerText: true })
    else await expect(words).toContainText('Cheeseburger + French fries (kept):')
    await expect(words.locator('.font-semibold')).toHaveText('almost all in the stomach')
    await expect(words).toBeVisible()
    await page.goto(`${COLA_KEPT_BURGER}&t=40&lang=hi`)
    await expect(words.locator('.font-semibold')).toHaveText('लगभग सारा भाग आमाशय में')
    await expect(words).toContainText('रखा गया भोजन (चीज़बर्गर + फ़्रेंच फ़्राइज़):')
  })

  test('once the gut has finished with the meal it says "Done", never "Stomach" (cheeseburger at 30 h)', async ({ page }) => {
    await page.goto('/next?v=2&a=cheeseburger:1&t=1800')
    const now = page.locator('[data-now]')
    await expect(now).toHaveAttribute('data-now', 'done')
    await expect(now.getByRole('button', { name: 'Done: more about this stage' })).toBeVisible()
    await expect(now.locator('> div:first-child > p:not([aria-hidden])')).toContainText('the gut is finished with this meal')
  })

  test('clearing the meal closes "More": the next food does not open it again', async ({ page }) => {
    onlyIn('desktop')
    await page.goto('/next?v=2&a=cola:1&t=20')
    await page.getByRole('button', { name: 'Stomach: more about this stage' }).click()
    await expect(page.getByRole('region', { name: 'Stomach' })).toBeVisible()
    await page.getByRole('button', { name: /^Remove Cola/ }).click()
    await page.getByRole('button', { name: /Roti/ }).first().click()
    await expect(page.locator('[data-now]')).toBeVisible()
    await expect(page.locator('[data-stage-more]')).toHaveCount(0)
  })

  test('the organ opens the full stage text; Esc closes it and gives focus back', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&t=20')
    const pill = page.getByRole('button', { name: 'Stomach: more about this stage' })
    await pill.click()
    const more = page.getByRole('region', { name: 'Stomach' })
    await expect(more).toBeVisible()
    await expect(more).toContainText('Hydrochloric acid')
    await expect(more.getByText('Absorbed here')).toBeVisible()
    await expect(pill).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(more).toBeHidden()
    await expect(pill).toBeFocused()
  })

  test('on a phone it is in the first screen, in place of the layer switch (English and Hindi)', async ({ page }) => {
    onlyIn('phone')
    for (const url of ['/next', `${COLA_KEPT_BURGER}&lang=hi`]) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('group', { name: /^(Body system|शरीर का तंत्र)$/ })).toBeHidden()
      await expectInFirstScreen(page, {
        'Now line': page.locator('[data-now] p:not([aria-hidden])'),
        summary: page.locator('[data-summary]'),
        body: page.getByRole('img', { name: /^(The body|शरीर)/ }),
        Play: page.getByRole('button', { name: /^(Play|चलाएँ)$/ }),
      })
    }
  })
})

test('on a phone’s first visit the medical note comes first, then the Now line and summary', async ({ browser }) => {
  onlyIn('phone')
  // A fresh visitor (no beforeEach note flag): its own context.
  const context = await browser.newContext({ ...test.info().project.use, storageState: undefined })
  const page = await context.newPage()
  await page.goto('/next')
  await expect(page.locator('[data-summary]')).toBeHidden()
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(page.locator('[data-summary]')).toBeVisible()
  await expect(page.locator('[data-now]')).toBeVisible()
  await context.close()
})

test.describe('the summary sentence', () => {
  test('one meal: when half of its food energy has left the stomach, on screen', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1')
    const summary = page.locator('[data-summary]')
    await expect(summary).toHaveText(/Half of the food energy in Cola has left the stomach after \d+ min\./)
    await expect(summary).toBeInViewport({ ratio: 1 })
  })

  test('cola against a kept burger + fries: which stomach empties faster', async ({ page }) => {
    await page.goto(COLA_KEPT_BURGER)
    const summary = page.locator('[data-summary="compare"]')
    await expect(summary).toContainText(/Cola leaves the stomach about \d+× faster than Cheeseburger \+ French fries\./)
    await expect(summary).toBeInViewport({ ratio: 1 })
    // The reason, only where there is room for it (not on a phone).
    if (test.info().project.name !== 'phone') await expect(summary.getByText(/Cola is only a drink/)).toBeVisible()
  })
})

test.describe('report a mistake on the stage', () => {
  test('report with no API opens GitHub and sends nothing', async ({ page, context }) => {
    onlyIn('desktop', 'phone')
    const posted: string[] = []
    context.on('request', (r) => {
      if (r.method() === 'POST' || r.url().includes('/feedback')) posted.push(`${r.method()} ${r.url()}`)
    })
    // Never reach the real GitHub from a test.
    await context.route('https://github.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>GitHub stub</title>' }))
    await page.goto('/next?v=2&a=cola:1')
    await page.getByRole('button', { name: 'Report a mistake' }).click()
    const dialog = page.getByRole('dialog', { name: 'Report a mistake' })
    await expect(dialog.getByText('This opens a public page on GitHub.')).toBeVisible()
    await dialog.getByLabel('Where is the mistake?').fill('Stomach graph')
    await dialog.getByLabel('What’s wrong, and what should it say?').fill('The half-way ring looks late.')
    const popupOpened = context.waitForEvent('page')
    await dialog.getByRole('button', { name: 'Open the report on GitHub' }).click()
    const popup = await popupOpened
    await popup.waitForURL(/^https:\/\/github\.com\/Sarthaks-24\/lifepeek\/issues\/new\?/)
    const issue = new URL(popup.url()).searchParams
    expect(issue.get('template')).toBe('mistake.md')
    expect(issue.get('title')).toBe('Mistake: Stomach graph')
    // The report carries this run's link, so it can be reproduced.
    expect(issue.get('body')).toMatch(/a=cola(:|%3A)1/)
    expect(posted).toEqual([])
  })

  test('"Copy link" says it copied in a status message, not by changing the button', async ({ page, context }) => {
    onlyIn('desktop')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/next?v=2&a=cola:1')
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeAttached()
    await expect(page.locator('button[aria-live]')).toHaveCount(0)
    // A second copy is said again: the status region empties, then says it once more (review 14-17, LOW 9).
    const status = page.getByRole('status').filter({ hasText: 'Link copied' })
    await status.evaluate((el) => {
      const w = window as unknown as { saidCopied: number }
      w.saidCopied = 0
      new MutationObserver(() => {
        if (el.textContent === 'Link copied') w.saidCopied++
      }).observe(el, { childList: true, characterData: true, subtree: true })
    })
    await page.getByRole('button', { name: 'Link copied' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { saidCopied: number }).saidCopied)).toBeGreaterThanOrEqual(1)
  })
})
