import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import {
  bodySettled,
  interactiveOverlaps,
  linkRoundTripProblems,
  measureBody,
  openMealActions,
  overlayProblems,
  redCheck,
  returningVisitor,
  skipWithoutHindi,
  tryStep,
  watchConsole,
} from './helpers/gate.ts'

// The red list (T0; plan qa-fixes §0, §1.1). One report test per QA-sweep bug (cache/plans/v3/qa/
// bug-sweep.md §3) that was seen failing on eee16c9; e2e/red-list.md lists them, what was measured,
// and the ones not reproduced (B14, B16, B17) or checked elsewhere (B26: the budget ledger and perf reports). Each test
// measures, then `redCheck` records "reproduced" or "not seen" and, while its RED_LIST mode is
// "report", passes either way. The T-step whose FP fixes a bug flips it to "enforce".
// Project: redlist (Chromium, software WebGL). Each block sets its own window.

const KEPT = '/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1'
const SIX_FOODS = '/sim?v=3&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1'
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const phone = (width: number, height: number) => ({
  viewport: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

/** Projector mode on, as a teacher would have it (the pref Layout reads at start). */
async function projectorOn(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lifepeek:projector', '1'))
}

/** The stage has drawn its body and graphs. */
async function stageReady(page: Page) {
  await page.locator('[data-stage]').waitFor()
  await page.locator('[data-body]').first().waitFor({ state: 'attached' })
  await page.waitForLoadState('networkidle')
  await bodySettled(page, 10_000)
  await page.evaluate(() => document.fonts.ready)
}

test.beforeEach(async ({ page }) => returningVisitor(page))
// A step that cannot finish fails in seconds, as a problem of its check (`red`), not at the test's timeout.
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })

/**
 * One red-list check: `measure` adds what it finds to `problems`, then `redCheck` records it. A step
 * that throws (a button not there, a wait that times out) is one more problem, so a report-mode
 * bug never fails its test; once the bug is enforced, it fails like any other problem.
 */
async function red(bug: Parameters<typeof redCheck>[0], measure: (problems: string[]) => Promise<void>) {
  const problems: string[] = []
  const thrown = await tryStep(() => measure(problems))
  if (thrown) problems.push(`the check could not finish: ${thrown}`)
  redCheck(bug, problems)
}

test.describe('Android 360×640', () => {
  test.use(phone(360, 640))

  test('B1 the body is visible at 360×640 and 320×568 (≥ 160 px, covered ≤ 10 %)', async ({ page }) => {
    await red('B1', async (problems) => {
      for (const [w, h] of [
        [360, 640],
        [320, 568],
      ] as const) {
        await page.setViewportSize({ width: w, height: h })
        for (const url of ['/sim', '/sim?lang=hi', `${KEPT}&lang=hi`]) {
          await page.goto(url)
          await stageReady(page)
          const m = await measureBody(page)
          if (m.visibleHeight < 160) problems.push(`${w}×${h} ${url}: body ${m.visibleHeight} px tall`)
          if (m.covered > 0.1)
            problems.push(`${w}×${h} ${url}: ${Math.round(100 * m.covered)} % covered (${m.coveredBy.slice(0, 2).join(', ')})`)
        }
      }
    })
  })

  test('B2 the meal bar is one row at 320–390 px', async ({ page }) => {
    await red('B2', async (problems) => {
      for (const w of [320, 360, 375, 390]) {
        await page.setViewportSize({ width: w, height: 640 })
        await page.goto('/sim')
        await stageReady(page)
        // Distinct row tops of the meal bar's visible controls.
        const rows = await page.locator('section[aria-labelledby="meal-bar-title"] button').evaluateAll((els) => {
          const tops = els
            .filter((e) => e.getBoundingClientRect().height > 1 && getComputedStyle(e).visibility !== 'hidden')
            .map((e) => Math.round(e.getBoundingClientRect().top / 8))
          return new Set(tops).size
        })
        const height = await page
          .locator('section[aria-labelledby="meal-bar-title"]')
          .evaluate((e) => Math.round(e.getBoundingClientRect().height))
        if (rows > 1) problems.push(`${w} px: the meal bar has ${rows} rows of controls, ${height} px tall`)
      }
    })
  })

  test('B5 "How we know" has a close button and stays on screen', async ({ page }) => {
    await red('B5', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      await page
        .getByRole('button', { name: /^How we know/ })
        .filter({ visible: true })
        .first()
        .click()
      const dialog = page.getByRole('dialog', { name: /^How we know/ })
      await expect(dialog).toBeVisible()
      problems.push(...(await overlayProblems(page, dialog)))
    })
  })

  test('B7 the header is one row (≤ 56 px) at 360 and 320, in the pseudo-locale and in Hindi', async ({ page }) => {
    await red('B7', async (problems) => {
      // The +40 % pseudo-locale stands in for Hindi while it is paused (R47); only the e2e build has it.
      for (const w of [360, 320]) {
        await page.setViewportSize({ width: w, height: 640 })
        await page.goto('/sim?lang=pseudo')
        await stageReady(page)
        const h = await page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().height))
        if (h > 56) problems.push(`${w} px pseudo-locale: header ${h} px tall`)
      }
      for (const w of [360, 320]) {
        await page.setViewportSize({ width: w, height: 640 })
        await page.goto('/sim?lang=hi')
        await skipWithoutHindi(page)
        await stageReady(page)
        const h = await page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().height))
        if (h > 56) problems.push(`${w} px Hindi: header ${h} px tall`)
      }
    })
  })

  test('B8 Home chart text is ≥ 12 px at 360', async ({ page }) => {
    await red('B8', async (problems) => {
      await page.goto('/')
      const svg = page.locator('main svg[role="img"]').first()
      await expect(svg).toBeVisible()
      const heights = await svg.locator('text').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0))
      const small = heights.filter((h) => h < 12)
      if (small.length)
        problems.push(`${small.length} of ${heights.length} chart labels draw under 12 px (smallest ${Math.min(...small).toFixed(1)} px)`)
    })
  })

  test('B9 Hindi Home: "Open the simulator" is in the first screen at 360×640', async ({ page }) => {
    await red('B9', async (problems) => {
      // Home reads the saved language (a ?lang= link is the stage's).
      await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'hi'))
      await page.goto('/')
      await skipWithoutHindi(page)
      const cta = page.locator('main a[href="/sim"]').first()
      await expect(cta).toBeVisible()
      const box = (await cta.boundingBox())!
      if (box.y + box.height > 640) problems.push(`the CTA ends at y ${Math.round(box.y + box.height)} in a 640 px screen`)
    })
  })

  test('B11 a phone and a tablet can share the link', async ({ page }) => {
    await red('B11', async (problems) => {
      for (const [w, h] of [
        [360, 640],
        [768, 1024],
        [800, 1280],
      ] as const) {
        await page.setViewportSize({ width: w, height: h })
        await page.goto('/sim')
        await stageReady(page)
        const share = page.getByRole('button', { name: /^(Copy link|Share)/ }).filter({ visible: true })
        if (!(await share.count())) problems.push(`${w}×${h}: no Copy link or Share button`)
      }
    })
  })
})

test.describe('phone 390×844', () => {
  test.use(phone(390, 844))

  test('B4 "Keys and settings" does not overlap the timeline', async ({ page }) => {
    await red('B4', async (problems) => {
      for (const [w, h] of [
        [390, 844],
        [360, 640],
      ] as const) {
        await page.setViewportSize({ width: w, height: h })
        for (const url of ['/sim', '/sim?lang=hi']) {
          await page.goto(url)
          await stageReady(page)
          // The button is "Settings" since T5 (FP-3); nothing may lie on it, the slider or a moment's target.
          for (const o of await interactiveOverlaps(page))
            if (/Settings|Keys and settings|सेटिंग|slider|Timeline|समयरेखा|"\d/.test(o)) problems.push(`${w}×${h} ${url}: ${o}`)
        }
      }
    })
  })

  test('B6 Back closes a sheet and stays on the stage', async ({ page }) => {
    await red('B6', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      await page.getByRole('button', { name: 'Add food' }).click()
      await expect(page.getByRole('dialog', { name: 'Add food' })).toBeVisible()
      await page.goBack()
      await page.waitForTimeout(500)
      const url = page.url()
      if (!/\/sim(\?|$)/.test(new URL(url).pathname + new URL(url).search)) problems.push(`Back left the stage, to ${url}`)
      else if (await page.getByRole('dialog', { name: 'Add food' }).isVisible()) problems.push('Back left the sheet open')
    })
  })

  test('B10 projector mode on a phone: menu closes, Energy tab not clipped', async ({ page }) => {
    await red('B10', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      const menu = page.getByRole('button', { name: 'Menu' })
      await menu.click()
      await page.getByRole('button', { name: 'Projector mode' }).filter({ visible: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
      await page.waitForTimeout(500)
      if ((await menu.getAttribute('aria-expanded')) === 'true') problems.push('the menu stays open after switching projector mode on')
      const vw = await page.evaluate(() => document.documentElement.clientWidth)
      // The graph tabs are toggle buttons in the "Graphs" group (Segmented), not role=tab. T6 keeps
      // them whole (graphs.spec.ts enforces it); the menu half of B10 is T4's.
      for (const tab of await page.getByRole('group', { name: 'Graphs' }).getByRole('button').filter({ visible: true }).all()) {
        const clip = await tab.evaluate((e, vw) => {
          const r = e.getBoundingClientRect()
          let right = vw
          for (let p = e.parentElement; p; p = p.parentElement)
            if (getComputedStyle(p).overflowX !== 'visible') right = Math.min(right, p.getBoundingClientRect().right)
          return r.right > right + 1 || e.scrollWidth > e.clientWidth + 1
            ? `${e.textContent?.trim()} ends at ${Math.round(r.right)} of ${Math.round(right)}`
            : ''
        }, vw)
        if (clip) problems.push(`tab clipped: ${clip}`)
      }
    })
  })
})

test.describe('phone landscape and 200 % zoom', () => {
  test.use(phone(640, 360))

  test('B3 the body shows in landscape and at 200 % zoom (≥ 160 px)', async ({ page }) => {
    await red('B3', async (problems) => {
      for (const [w, h] of [
        [640, 360],
        [844, 390],
        [640, 400],
      ] as const) {
        await page.setViewportSize({ width: w, height: h })
        await page.goto('/sim')
        await stageReady(page)
        const m = await measureBody(page)
        if (m.visibleHeight < 160) problems.push(`${w}×${h}: body ${m.visibleHeight} px tall in the first screen`)
      }
    })
  })
})

test.describe('projector', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test.beforeEach(async ({ page }) => projectorOn(page))

  test('B12 the body is ≥ 40 % of the stage with a kept meal, EN and HI', async ({ page }) => {
    await red('B12', async (problems) => {
      for (const [w, h] of [
        [1280, 800],
        [1024, 768],
        [1366, 768],
      ] as const) {
        await page.setViewportSize({ width: w, height: h })
        for (const url of [KEPT, `${KEPT}&lang=hi`]) {
          await page.goto(url)
          await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
          await stageReady(page)
          const m = await measureBody(page)
          if (m.stageShare < 0.4)
            problems.push(`${w}×${h} ${url.endsWith('hi') ? 'HI' : 'EN'}: body ${Math.round(100 * m.stageShare)} % of the stage`)
        }
      }
    })
  })

  test('B13 Hindi projector timeline ticks are ≥ 8 px apart', async ({ page }) => {
    await red('B13', async (problems) => {
      await page.goto(`${KEPT}&lang=hi`)
      await skipWithoutHindi(page)
      await stageReady(page)
      const boxes = await page.locator('[data-tick]').evaluateAll((els) =>
        els
          .filter((e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
          .map((e) => ({ text: e.textContent ?? '', l: e.getBoundingClientRect().left, r: e.getBoundingClientRect().right }))
          .sort((a, b) => a.l - b.l),
      )
      for (let i = 1; i < boxes.length; i++) {
        const gap = boxes[i]!.l - boxes[i - 1]!.r
        if (gap < 8) problems.push(`"${boxes[i - 1]!.text}" and "${boxes[i]!.text}" ${gap.toFixed(1)} px apart`)
      }
    })
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('B15 with 6 foods (and 3 bouts) every chip is visible or counted, on one row', async ({ page }) => {
    await red('B15', async (problems) => {
      // `fixture=bouts`: the e2e build's three longest activity-bout chips (MealBar), as v3 will add them.
      for (const [url, count] of [
        [SIX_FOODS, 6],
        [`${SIX_FOODS}&fixture=bouts`, 9],
      ] as const) {
        for (const w of [1440, 360, 320]) {
          await page.setViewportSize({ width: w, height: w > 400 ? 900 : 640 })
          await page.goto(url)
          await stageReady(page)
          const bar = page.locator('section[aria-labelledby="meal-bar-title"]')
          const chips = await bar.locator('ul > li').evaluateAll((els) => {
            const strip = els[0]?.parentElement?.getBoundingClientRect()
            return els.map((e) => {
              const r = e.getBoundingClientRect()
              const servings = e.querySelector('.tabular')
              return {
                shown: !!strip && r.width > 0 && r.left >= strip.left - 1 && r.right <= strip.right + 1,
                top: Math.round(r.top),
                // A shown food chip keeps its "×1" whole (the name shortens first).
                servings: !servings || servings.getBoundingClientRect().right <= r.right + 1,
              }
            })
          })
          const shown = chips.filter((c) => c.shown)
          const plus = await bar
            .getByText(/^\+\d+$/)
            .filter({ visible: true })
            .allTextContents()
          const counted = plus.length ? Number(plus[0]!.slice(1)) : 0
          const where = `${w} px${count === 9 ? ' with 3 bouts' : ''}`
          if (chips.length !== count) problems.push(`${where}: ${chips.length} chips for ${count}`)
          else if (shown.length + counted !== count) problems.push(`${where}: ${shown.length} chips shown + "+${counted}" for ${count}`)
          if (new Set(shown.map((c) => c.top)).size > 1) problems.push(`${where}: the chips are on more than one row`)
          if (shown.some((c) => !c.servings)) problems.push(`${where}: a chip's servings are cut`)
        }
      }
    })
  })

  test('B18 the clock keeps pace when frames are slow (250 ms)', async ({ page }) => {
    await red('B18', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      const slider = page.getByRole('slider').first()
      const advance = async (slow: boolean) => {
        await slider.press('Home')
        return page.evaluate(async (slow) => {
          const w = window as unknown as { __burn?: boolean }
          w.__burn = slow
          if (slow) {
            // Every frame takes about 250 ms of main-thread work (a 2 GB phone drawing the 3D body).
            const burn = () => {
              const t = performance.now()
              while (performance.now() - t < 240);
              if (w.__burn) requestAnimationFrame(burn)
            }
            requestAnimationFrame(burn)
          }
          const value = () => Number(document.querySelector('[role=slider]')?.getAttribute('aria-valuenow'))
          const play = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Play')!
          play.click()
          const t0 = performance.now()
          await new Promise((r) => setTimeout(r, 3000))
          const v = value()
          const secs = (performance.now() - t0) / 1000
          w.__burn = false
          ;[...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Pause')?.click()
          return v / secs
        }, slow)
      }
      const normal = await advance(false)
      const slow = await advance(true)
      const ratio = slow / normal
      // ±10 % (T7): real elapsed time, timed in the page.
      if (Math.abs(ratio - 1) > 0.1)
        problems.push(
          `with 250 ms frames the clock runs at ${Math.round(100 * ratio)} % of its pace (${slow.toFixed(1)} vs ${normal.toFixed(1)} sim min/s)`,
        )
    })
  })

  test('B18 a hidden page does not move the clock, and goes on without a jump when shown', async ({ page }) => {
    test.slow()
    await red('B18', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      await page.getByRole('slider').first().press('Home')
      await page.getByRole('button', { name: 'Play' }).click()
      const value = () => page.getByRole('slider').first().getAttribute('aria-valuenow').then(Number)
      const setHidden = (hidden: boolean) =>
        page.evaluate((hidden) => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
          document.dispatchEvent(new Event('visibilitychange'))
        }, hidden)
      await page.waitForTimeout(500)
      await setHidden(true)
      const before = await value()
      await page.waitForTimeout(10_000)
      const after = await value()
      if (after !== before) problems.push(`hidden for 10 s, the clock moved from ${before} to ${after} min`)
      await setHidden(false)
      await page.waitForTimeout(1000)
      const shown = await value()
      // About 1 s of play at the default pace (< 30 sim min), not the 10 s it was hidden.
      if (shown <= after) problems.push('shown again, the clock did not go on')
      else if (shown - after > 60) problems.push(`shown again, the clock jumped ${shown - after} min in 1 s`)
    })
  })

  test('B19 no console errors or warnings on /sim', async ({ page }) => {
    await red('B19', async (problems) => {
      const console = watchConsole(page)
      await page.goto('/sim')
      await stageReady(page)
      await expect(page.locator('[data-body="3d"]')).toBeVisible()
      await page.getByRole('button', { name: 'Play' }).click()
      await page.waitForTimeout(1500)
      problems.push(...[...new Set(console.problems())])
    })
  })

  /** B20: the placeholders ("<project email>") in the Privacy page's text. */
  async function privacyPlaceholders(page: Page, problems: string[], label: string) {
    await page.goto('/privacy')
    await page.locator('main h1').waitFor()
    const text = await page.locator('main').innerText()
    for (const m of text.match(/<[^<>\n]{2,40}>/g) ?? []) problems.push(`${label}: "${m}"`)
  }

  test('B20 the Privacy page has no placeholder', async ({ page }) => {
    await red('B20', (problems) => privacyPlaceholders(page, problems, 'English'))
  })

  test('B20 the Hindi Privacy page has no placeholder', async ({ page }) => {
    // The page reads the saved language (a ?lang= link is the stage's), as in B9. Hindi is paused
    // (R47): a build without it skips this half; scripts/red-list.mjs joins the two halves.
    await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'hi'))
    await page.goto('/privacy')
    await skipWithoutHindi(page)
    await red('B20', (problems) => privacyPlaceholders(page, problems, 'Hindi'))
  })

  test('B21 a link that is changed on load says so', async ({ page }) => {
    await red('B21', async (problems) => {
      for (const [link, what] of [
        ['/sim?v=3&a=cola:999', 'a'],
        ['/sim?v=3&a=water:1,milk:1,roti:1,dal:1,apple:1,banana:1,cola:1,fries:1', 'a'],
        ['/sim?v=3&a=cola:1&t=99999', 't'],
      ] as const) {
        const changed = await linkRoundTripProblems(page, link)
        const notes = await page.locator('[data-stage] [role="note"]').count()
        if (changed.some((c) => c.startsWith(`${what}=`)) && !notes) problems.push(`${link}: ${changed.join('; ')}, and no note says so`)
      }
    })
  })

  test('B22 lang is written only when chosen', async ({ page }) => {
    await red('B22', async (problems) => {
      const changed = await linkRoundTripProblems(page, '/sim?v=3&a=cola:1')
      problems.push(...changed.filter((c) => c.startsWith('lang=')))
    })
  })

  test('B23 Teach step 2 matches the lesson link (opens at 35 min)', async ({ page }) => {
    await red('B23', async (problems) => {
      await page.goto('/teach')
      const lesson = page.locator('main a[href*="/sim?"]').first()
      await expect(lesson).toBeVisible()
      const t = new URL((await lesson.getAttribute('href'))!, 'http://x').searchParams.get('t')
      const step2 = await page.locator('main ol > li').nth(1).innerText()
      if (t && Number(t) > 0 && !/Home/.test(step2))
        problems.push(`the lesson opens at ${t} min, but step 2 ("${step2.slice(0, 60)}…") says only "press Play"`)
    })
  })

  test('B24 the report form shows one privacy warning', async ({ page }) => {
    await red('B24', async (problems) => {
      await page.goto('/sim')
      await stageReady(page)
      await openMealActions(page)
      await page.getByRole('button', { name: 'Report a mistake' }).filter({ visible: true }).first().click()
      // By name: the form opens inside the "⋯" panel, itself a dialog (FP-1).
      const dialog = page.getByRole('dialog', { name: 'Report a mistake' })
      await expect(dialog).toBeVisible()
      const warnings = await dialog.getByText(/\bpublic\b/i).count()
      if (warnings > 1) problems.push(`${warnings} privacy warnings in the report form`)
    })
  })

  test('B25 no dead store actions (swapKept)', async () => {
    await red('B25', async (problems) => {
      const src = path.join(web, 'src')
      const files = (fs.readdirSync(src, { recursive: true }) as string[])
        .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
        .map((f) => fs.readFileSync(path.join(src, f), 'utf8'))
      const uses = files.reduce((n, text) => n + (text.match(/\bswapKept\b/g)?.length ?? 0), 0)
      // Two mentions are its type and its definition in state/run.ts; any more is a caller.
      if (uses > 0 && uses <= 2) problems.push('swapKept is defined in state/run.ts but nothing calls it')
    })
  })
})
