import { expect, test, type Locator, type Page } from '@playwright/test'
import { onlyIn, openMealActions } from './helpers/gate.ts'

// WP-15 on /sim: everything works without a mouse (G8, UI-6). The key map and its off-switch,
// the graphs as tables, their summaries for screen readers, and the timeline's key moments
// (merged where they nearly coincide, council round 2). Projects desktop (1440), projector (1280,
// projector mode) and phone (390, where it checks the targets and the sheets).

const COLA_KEPT_BURGER = '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1'
const params = (page: Page) => new URL(page.url()).searchParams
const now = (page: Page) => page.getByRole('slider', { name: 'Timeline' }).getAttribute('aria-valuenow').then(Number)

test.beforeEach(async ({ page }) => {
  // A returning visitor: the first-run medical note is closed.
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
})

/** Presses Tab until `target` has the focus (a real keyboard user's way there). */
async function tabTo(page: Page, target: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab never reached ${target}`)
}

test('a whole lesson with the keyboard only: add a food, play, step through the moments, keep, table, Esc', async ({ page }) => {
  onlyIn('desktop', 'projector')
  await page.goto('/sim?v=2&a=cola:1')
  await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()

  // Add an apple from the food search, typing its name; the letters typed are not shortcuts.
  const add = page.getByRole('button', { name: 'Add food' })
  await tabTo(page, add)
  await page.keyboard.press('Enter')
  const sheet = page.getByRole('dialog', { name: 'Add food' })
  await expect(sheet.getByRole('combobox')).toBeFocused()
  await page.keyboard.type('apple')
  await page.keyboard.press('Enter')
  await expect(sheet).toBeHidden()
  await expect(add).toBeFocused()
  await expect(page.getByRole('img', { name: 'The body, digesting Cola + Apple' })).toBeVisible()
  expect(params(page).has('b'), 'typing "p" in the search kept nothing').toBe(false)

  // K plays and pauses (Space is the focused button's own).
  await page.keyboard.press('k')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.keyboard.press('k')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()

  // Home, then Page Down through the key moments (a clicker's button), each later than the last.
  await page.keyboard.press('Home')
  expect(await now(page)).toBe(0)
  const seen: number[] = []
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('PageDown')
    await expect.poll(() => now(page)).not.toBe(seen.at(-1) ?? 0)
    seen.push(await now(page))
  }
  expect(seen).toEqual([...seen].sort((a, b) => a - b))
  // Paused on a moment, screen readers hear the graphs' values. Its name does not pop up over the
  // graph (council round 3): only a marker's own hover, keyboard focus or press shows it.
  await expect(page.locator('[data-marker-tip]')).toHaveCount(0)
  await expect(page.locator('[data-announcer]')).toHaveText(/after eating: .+ \d+/)
  await page.keyboard.press('PageUp')
  await expect.poll(() => now(page)).toBe(seen[1])
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => now(page)).toBe(seen[1]! + 10)
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => now(page)).toBe(seen[1]! - 50)

  // P keeps the meal to compare; then "Keep to compare" is off, and says why.
  await page.keyboard.press('p')
  await expect(page.getByText('Kept: Cola + Apple', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect.poll(() => params(page).get('b')).toBe('cola:1,apple:1')
  const keep = page.getByRole('button', { name: 'Keep to compare' })
  await expect(keep).toHaveAttribute('aria-disabled', 'true')
  await expect(keep).toHaveAccessibleDescription('This meal is the one kept')

  // T opens the graphs as a table; Esc closes it and gives the focus back.
  const before = await page.evaluate(() => document.activeElement?.outerHTML)
  await page.keyboard.press('t')
  const table = page.getByRole('dialog', { name: 'The graphs as a table' })
  await expect(table).toBeVisible()
  await expect(table.locator('[data-strip-table] tbody tr')).toHaveCount(13)
  await page.keyboard.press('Escape')
  await expect(table).toBeHidden()
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(before)

  // S, B and E pick a graph where they show one at a time (the projector).
  if (test.info().project.name === 'projector') {
    await page.keyboard.press('b')
    await expect(page.getByRole('button', { name: 'Blood sugar', pressed: true })).toBeVisible()
    await page.keyboard.press('e')
    await expect(page.getByRole('button', { name: 'Energy', pressed: true })).toBeVisible()
    await page.keyboard.press('s')
    await expect(page.getByRole('button', { name: 'Stomach', pressed: true })).toBeVisible()
  }
})

test('? lists the keys; the letter keys can be switched off (WCAG 2.1.4), and the clicker keys still work', async ({ page }) => {
  onlyIn('desktop', 'projector')
  await page.goto('/sim?v=2&a=cola:1')
  await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
  await page.keyboard.press('?')
  const help = page.getByRole('dialog', { name: 'Keys and settings' })
  await expect(help).toBeVisible()
  await expect(help.getByText('Next or previous key moment (a clicker’s two buttons)')).toBeVisible()
  const letters = help.getByRole('switch', { name: 'Letter keys' })
  await expect(letters).toHaveAttribute('aria-checked', 'true')
  await tabTo(page, letters)
  await page.keyboard.press('Space')
  await expect(letters).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => localStorage.getItem('lifepeek:keysOff'))).toBe('1')
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()

  // Off: T and ? do nothing, Page Down still steps.
  await page.locator('body').press('t')
  await page.locator('body').press('?')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('PageDown')
  await expect.poll(() => now(page)).toBeGreaterThan(0)

  // Saved: still off after a reload; the settings button opens the sheet to switch them back.
  await page.reload()
  await page.getByRole('button', { name: 'Keys and settings' }).click()
  await expect(help.getByRole('switch', { name: 'Letter keys' })).toHaveAttribute('aria-checked', 'false')
})

test('"Reduce motion" can be chosen on screen and is saved; it can follow the device again', async ({ page }) => {
  onlyIn('desktop', 'phone')
  await page.goto('/sim?v=2&a=cola:1')
  await page.getByRole('button', { name: 'Keys and settings' }).click()
  const help = page.getByRole('dialog', { name: 'Keys and settings' })
  const motion = help.getByRole('switch', { name: 'Reduce motion' })
  await expect(motion).toHaveAttribute('aria-checked', 'false')
  await motion.click()
  await expect(motion).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => localStorage.getItem('lifepeek:reduceMotion'))).toBe('1')
  await expect(page.locator('[data-particles]').first()).toHaveAttribute('data-particles', 'still')
  await help.getByRole('button', { name: 'Follow the device’s setting again' }).click()
  expect(await page.evaluate(() => localStorage.getItem('lifepeek:reduceMotion'))).toBeNull()
  await expect(motion).toHaveAttribute('aria-checked', 'false')
})

test('every graph has a summary for screen readers and a working table', async ({ page }) => {
  onlyIn('desktop', 'projector', 'phone')
  await page.goto(COLA_KEPT_BURGER)
  const expected: Record<string, RegExp> = {
    Stomach:
      /^The stomach holds \d+ g at the start\. Half of the meal's food energy has left by \d+ min\. Kept: Cheeseburger \+ French fries\. /,
    'Blood sugar': /^Blood sugar starts at about \d+ mg\/dL, is highest at about \d+ mg\/dL after \d+ min/,
    Energy: /^In the first 6 h, about \d+ kcal from this meal entered the body/,
  }
  for (const [strip, summary] of Object.entries(expected)) {
    // One graph at a time on a phone and the projector: pick it first.
    const tab = page.getByRole('button', { name: strip, exact: true })
    if (await tab.isVisible()) await tab.click()
    const name = strip === 'Stomach' ? 'Food in the stomach' : strip
    const figure = page.getByRole('figure', { name })
    await expect(figure).toHaveAccessibleDescription(summary)
    await figure.getByRole('button', { name: `Show as table: ${name}` }).click()
    const sheet = page.getByRole('dialog', { name: 'The graphs as a table' })
    await expect(sheet.locator('[data-strip-table] caption > span').last()).toHaveText(summary)
    await expect(sheet.locator('[data-strip-table] tbody tr')).toHaveCount(13)
    await expect(sheet.locator('[data-strip-table] thead th')).toContainText([/After eating/, /Kept: Cheeseburger/])
    // The key moments of both meals; "mostly absorbed" by its own name, not as one nutrient's (S6).
    const moments = sheet.locator('[data-moments-table]')
    await expect(moments.getByRole('rowheader', { name: 'Carbs, protein and fat mostly absorbed' })).toBeVisible()
    await expect(moments.getByRole('rowheader', { name: 'Half the energy has left the stomach' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(sheet).toBeHidden()
  }
})

test.describe('the timeline’s key moments (council round 2)', () => {
  test('moments that nearly coincide are one marker naming them all; no two targets overlap; each is at least 24 px', async ({ page }) => {
    onlyIn('projector', 'phone')
    for (const url of [COLA_KEPT_BURGER, `${COLA_KEPT_BURGER}&lang=hi`, '/sim?v=2&a=roti:2,dal:1&b=water:1']) {
      await page.goto(url)
      const markers = page.locator('[data-marker]')
      await expect(markers.first()).toBeVisible()
      const boxes = await markers.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, w: r.width, h: r.height, name: el.getAttribute('aria-label') ?? '' }
        }),
      )
      for (const [i, a] of boxes.entries()) {
        expect(a.w, `${url}: ${a.name} width`).toBeGreaterThanOrEqual(23.5)
        expect(a.h, `${url}: ${a.name} height`).toBeGreaterThanOrEqual(23.5)
        for (const b of boxes.slice(i + 1)) {
          const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
          expect(overlap, `${url}: "${a.name}" overlaps "${b.name}"`).toBe(false)
        }
      }
      // Each marker is drawn as ONE dot (a cluster: one pill with its count), and in each row
      // two markers' dots are at least a target apart: 44 px on a phone, 24 px from 1024 px up
      // (council round 3: a phone showed a cluster as four dots ~10 px apart).
      const gap = test.info().project.name === 'phone' ? 44 : 24
      for (const lane of ['run', 'kept']) {
        const dots = await page.locator(`[data-marker="${lane}"]`).evaluateAll((els) =>
          els.map((el) => {
            const dots = el.querySelectorAll('[data-dot]')
            const r = dots[0]?.getBoundingClientRect()
            const moments = (el.getAttribute('data-moment') ?? '').split(' ').length
            return { n: dots.length, x: r ? r.x + r.width / 2 : NaN, count: dots[0]?.textContent ?? '', moments }
          }),
        )
        for (const [i, d] of dots.entries()) {
          expect(d.n, `${url}: ${lane} marker ${i} dots`).toBe(1)
          expect(d.count, `${url}: ${lane} marker ${i} count`).toBe(d.moments > 1 ? String(d.moments) : '')
          if (i > 0) expect(d.x - dots[i - 1]!.x, `${url}: ${lane} markers ${i - 1}–${i}`).toBeGreaterThanOrEqual(gap - 0.5)
        }
      }
    }
    // Cola's first hour (half has left, highest) is one marker that names both.
    await page.goto('/sim?v=2&a=cola:1&lang=en')
    await expect(page.locator('[data-marker="run"]').first()).toHaveAttribute(
      'aria-label',
      /^Half the energy has left the stomach, .+; Blood sugar highest, /,
    )
  })

  test('a meal with one moment gets a full-size target, its dot in the middle (verify: 12 px button)', async ({ page }) => {
    onlyIn('projector', 'phone')
    await page.goto('/sim?v=2&a=water:1')
    const marker = page.locator('[data-marker="run"]')
    await expect(marker).toHaveCount(1)
    const box = (await marker.boundingBox())!
    const dot = (await marker.locator('[data-dot]').boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(23.5)
    expect(Math.abs(dot.x + dot.width / 2 - (box.x + box.width / 2))).toBeLessThan(1.5)
  })

  test('each meal’s markers are one Tab stop; arrows move between them, Enter jumps there', async ({ page }) => {
    onlyIn('desktop', 'projector')
    await page.goto(COLA_KEPT_BURGER)
    const lane = page.getByRole('toolbar', { name: 'Key moments of this meal' })
    const markers = lane.getByRole('button')
    await expect(markers.nth(1)).toBeAttached()
    await tabTo(page, markers.first())
    await page.keyboard.press('ArrowRight')
    await expect(markers.nth(1)).toBeFocused()
    await expect(markers.nth(1)).toHaveAttribute('tabindex', '0')
    await expect(markers.first()).toHaveAttribute('tabindex', '-1')
    await page.keyboard.press('Enter')
    await expect.poll(() => now(page)).toBeGreaterThan(30)
    // The kept meal's markers are their own stop, and also named.
    await expect(page.getByRole('toolbar', { name: 'Key moments of the kept meal' }).getByRole('button').first()).toHaveAttribute(
      'aria-label',
      /^Kept: /,
    )
  })

  test('pressed where moments coincide, all are named, the kept meal’s too; Page Down visits the kept meal’s moments', async ({ page }) => {
    onlyIn('desktop')
    // Cola kept and cola + water now: cola's "half has left" and "highest" share a minute, in both meals.
    await page.goto('/sim?v=2&a=cola:1,water:1&b=cola:1')
    await expect(page.locator('[data-marker="kept"]').first()).toBeAttached()
    await page.locator('[data-marker="run"]').first().click()
    // The pointer moves away: the names stay while the clock is where the press put it.
    await page.mouse.move(5, 5)
    await expect(page.locator('[data-marker-tip] > span')).toHaveText([
      /^Half the energy has left the stomach, \d+ min$/,
      /^Blood sugar highest, \d+ min$/,
      /^Kept: Half the energy has left the stomach, \d+ min$/,
      /^Kept: Blood sugar highest, \d+ min$/,
    ])
    // Once the clock moves on, they go.
    await page.locator('body').press('PageDown')
    await expect(page.locator('[data-marker-tip]')).toHaveCount(0)
    // Burger + fries kept: its "half has left" (hours after cola's) is a stop for Page Down.
    await page.goto(COLA_KEPT_BURGER)
    const keptHalf = page.locator('[data-marker="kept"][data-moment~="event.stomachHalfEmpty"]')
    await expect(keptHalf).toBeAttached()
    // Its time, as its name says it ("…, 4 h 35 min", rounded to 5 min).
    const [, h, m] = /, (\d+) h(?: (\d+) min)?/.exec((await keptHalf.getAttribute('aria-label'))!)!
    const at = Number(h) * 60 + Number(m ?? 0)
    await page.locator('body').press('Home')
    for (let i = 0; i < 8; i++) {
      await page.locator('body').press('PageDown')
      if (Math.abs((await now(page)) - at) <= 5) return
    }
    throw new Error('Page Down never stopped at the kept meal’s "half has left"')
  })
})

test('after keeping, the meal bar’s buttons keep their words (council SHOULD 11)', async ({ page }) => {
  onlyIn('desktop')
  await page.goto(COLA_KEPT_BURGER)
  // Copy link and Report are in "⋯" (FP-1), with their words.
  await openMealActions(page)
  for (const name of ['Keep to compare', 'Copy link', 'Report a mistake']) {
    await expect(page.getByRole('button', { name }).getByText(name, { exact: true })).toBeVisible()
  }
})

test('the food pieces in the body have a key, only for what the meal has', async ({ page }) => {
  onlyIn('desktop', 'phone')
  // After the start: at 0 min a phone shows the Play prompt in the key's place (WP-19).
  await page.goto('/sim?v=2&a=cola:1&t=40')
  const key = page.getByRole('list', { name: 'Food pieces in the body' })
  await expect(key).toBeVisible()
  await expect(key.getByRole('listitem')).toHaveText(['Carbohydrate', 'Water'])
})

test.describe('review 15 (FIX-D)', () => {
  // The network, not the service worker's cache, so a test can hold or fail a file.
  test.use({ serviceWorkers: 'block' })

  test('P, S, B and E say what they did; the kept value is said once per graph', async ({ page }) => {
    onlyIn('desktop', 'projector')
    await page.goto('/sim?v=2&a=cola:1&t=60')
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    const said = page.locator('[data-announcer]')
    await page.locator('body').press('p')
    await expect(said).toHaveText('Kept: Cola')
    // P again on the kept meal: nothing to keep, and it says why.
    await page.locator('body').press('p')
    await expect(said).toHaveText('This meal is the one kept')
    await page.locator('body').press('b')
    await expect(said).toHaveText(/^1 h after eating: Blood sugar \d+ mg\/dL, kept meal \d+ mg\/dL\.$/)
    // Energy: two lines, the kept value only for the first (energy used at rest is the same for every meal).
    await page.locator('body').press('e')
    await expect(said).toHaveText(/^1 h after eating: Energy coming in .+, kept meal .+; Energy used at rest [^;]+\.$/)
    expect((await said.textContent())!.match(/kept meal/g)).toHaveLength(1)
  })

  test('a sheet open when leaving the stage is not open on the next visit', async ({ page }) => {
    onlyIn('desktop')
    await page.goto('/')
    // Into the stage inside the app (as a link would), so its state outlives the visit.
    await page.evaluate(() => {
      history.pushState(null, '', '/sim?v=2&a=cola:1')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    await page.locator('body').press('t')
    await expect(page.getByRole('dialog', { name: 'The graphs as a table' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeHidden()
    await page.goForward()
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('dragging a selection out of a sheet does not close it; a press outside does', async ({ page }) => {
    onlyIn('desktop')
    await page.goto('/sim?v=2&a=cola:1')
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    await page.locator('body').press('t')
    const sheet = page.getByRole('dialog', { name: 'The graphs as a table' })
    await expect(sheet).toBeVisible()
    const caption = sheet.locator('[data-strip-table] caption > span').last()
    const from = (await caption.boundingBox())!
    const box = (await sheet.boundingBox())!
    await page.mouse.move(from.x + 4, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 40, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect(sheet).toBeVisible()
    await page.mouse.click(box.x - 40, box.y + box.height / 2)
    await expect(sheet).toBeHidden()
  })

  test('in "More", the scrolling keys scroll its text, not the clock', async ({ page }) => {
    onlyIn('desktop')
    // A short window, so the stage text is taller than its box.
    await page.setViewportSize({ width: 1440, height: 560 })
    await page.goto('/sim?v=2&a=cola:1&t=20')
    await page.getByRole('button', { name: 'Stomach: more about this stage' }).click()
    const text = page.locator('[data-stage-more] [data-scroll]')
    await expect(text).toContainText('Hydrochloric acid')
    expect(await text.evaluate((el) => el.scrollHeight > el.clientHeight), 'the text scrolls').toBe(true)
    await text.focus()
    const before = await now(page)
    await page.keyboard.press('PageDown')
    await expect.poll(() => text.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
    expect(await now(page)).toBe(before)
    // Left and right still move the clock from there.
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => now(page)).toBe(before + 10)
  })

  test('the in-app Reduce motion switch reaches CSS: the reveal on Home and the transitions do not run', async ({ page }) => {
    onlyIn('desktop')
    // The device does not ask for reduced motion (project desktop): only the switch does.
    await page.goto('/sim?v=2&a=cola:1')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    await page.getByRole('button', { name: 'Keys and settings' }).click()
    const help = page.getByRole('dialog', { name: 'Keys and settings' })
    const motion = help.getByRole('switch', { name: 'Reduce motion' })
    await motion.click()
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
    // The switch's own knob: no transition (the motion-reduce: variant follows the switch).
    const knob = motion.locator('span > span')
    expect(await knob.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe('none')
    // Every other transition is instant (a probe with a 1 s transition of its own).
    const probe = await page.evaluate(() => {
      const el = document.body.appendChild(document.createElement('div'))
      el.style.transition = 'opacity 1s'
      const s = parseFloat(getComputedStyle(el).transitionDuration)
      el.remove()
      return s
    })
    expect(probe).toBeLessThan(0.001)

    // Home, in a new page load: set before the first draw, the reveal is not animated.
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
    const reveal = page.locator('.race-reveal').first()
    await expect(reveal).toBeAttached()
    expect(await reveal.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')

    // Back to full motion, the reveal runs again.
    await page.evaluate(() => localStorage.setItem('lifepeek:reduceMotion', '0'))
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    expect(
      await page
        .locator('.race-reveal')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('race-reveal')
  })
})
