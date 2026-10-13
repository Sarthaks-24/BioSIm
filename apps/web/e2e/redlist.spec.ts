import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import {
  interactiveOverlaps,
  linkRoundTripProblems,
  measureBody,
  overlayProblems,
  redCheck,
  returningVisitor,
  skipWithoutHindi,
  watchConsole,
} from './helpers/gate.ts'

// The red list (T0; plan qa-fixes §0, §1.1). One report test per QA-sweep bug (cache/plans/v3/qa/
// bug-sweep.md §3) that was seen failing on eee16c9; e2e/red-list.md lists them, what was measured,
// and the ones not reproduced (B14, B16, B17) or checked elsewhere (B26: the budget ledger and perf reports). Each test
// measures, then `redCheck` records "reproduced" or "not seen" and, while its RED_LIST mode is
// "report", passes either way. The T-step whose FP fixes a bug flips it to "enforce".
// Project: redlist (Chromium, software WebGL). Each block sets its own window.

const KEPT = '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1'
const SIX_FOODS = '/sim?v=2&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1'
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
  await page.evaluate(() => document.fonts.ready)
}

test.beforeEach(async ({ page }) => returningVisitor(page))

test.describe('Android 360×640', () => {
  test.use(phone(360, 640))

  test('B1 the body is visible at 360×640 and 320×568 (≥ 160 px, covered ≤ 10 %)', async ({ page }) => {
    const problems: string[] = []
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
    redCheck('B1', problems)
  })

  test('B2 the meal bar is one row below 390 px', async ({ page }) => {
    const problems: string[] = []
    for (const w of [320, 360, 375]) {
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
      if (rows > 2) problems.push(`${w} px: the meal bar has ${rows} rows of controls, ${height} px tall`)
    }
    redCheck('B2', problems)
  })

  test('B5 "How we know" has a close button and stays on screen', async ({ page }) => {
    await page.goto('/sim')
    await stageReady(page)
    await page
      .getByRole('button', { name: /^How we know/ })
      .filter({ visible: true })
      .first()
      .click()
    const dialog = page.getByRole('dialog', { name: /^How we know/ })
    await expect(dialog).toBeVisible()
    redCheck('B5', await overlayProblems(page, dialog))
  })

  test('B7 the Hindi header is one row (≤ 56 px) at 360 and 320', async ({ page }) => {
    const problems: string[] = []
    for (const w of [360, 320]) {
      await page.setViewportSize({ width: w, height: 640 })
      await page.goto('/sim?lang=hi')
      await skipWithoutHindi(page)
      await stageReady(page)
      const h = await page.locator('header').evaluate((e) => Math.round(e.getBoundingClientRect().height))
      if (h > 56) problems.push(`${w} px Hindi: header ${h} px tall`)
    }
    redCheck('B7', problems)
  })

  test('B8 Home chart text is ≥ 12 px at 360', async ({ page }) => {
    await page.goto('/')
    const svg = page.locator('main svg[role="img"]').first()
    await expect(svg).toBeVisible()
    const heights = await svg.locator('text').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0))
    const small = heights.filter((h) => h < 12)
    redCheck(
      'B8',
      small.length
        ? [`${small.length} of ${heights.length} chart labels draw under 12 px (smallest ${Math.min(...small).toFixed(1)} px)`]
        : [],
    )
  })

  test('B9 Hindi Home: "Open the simulator" is in the first screen at 360×640', async ({ page }) => {
    // Home reads the saved language (a ?lang= link is the stage's).
    await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'hi'))
    await page.goto('/')
    await skipWithoutHindi(page)
    const cta = page.locator('main a[href="/sim"]').first()
    await expect(cta).toBeVisible()
    const box = (await cta.boundingBox())!
    redCheck('B9', box.y + box.height > 640 ? [`the CTA ends at y ${Math.round(box.y + box.height)} in a 640 px screen`] : [])
  })

  test('B11 a phone and a tablet can share the link', async ({ page }) => {
    const problems: string[] = []
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
    redCheck('B11', problems)
  })
})

test.describe('phone 390×844', () => {
  test.use(phone(390, 844))

  test('B4 "Keys and settings" does not overlap the timeline', async ({ page }) => {
    const problems: string[] = []
    for (const [w, h] of [
      [390, 844],
      [360, 640],
    ] as const) {
      await page.setViewportSize({ width: w, height: h })
      for (const url of ['/sim', '/sim?lang=hi']) {
        await page.goto(url)
        await stageReady(page)
        for (const o of await interactiveOverlaps(page))
          if (/Keys and settings|कुंजियाँ|सेटिंग/.test(o) && /slider|Timeline|समयरेखा|"\d/.test(o)) problems.push(`${w}×${h} ${url}: ${o}`)
      }
    }
    redCheck('B4', problems)
  })

  test('B6 Back closes a sheet and stays on the stage', async ({ page }) => {
    await page.goto('/sim')
    await stageReady(page)
    await page.getByRole('button', { name: 'Add food' }).click()
    await expect(page.getByRole('dialog', { name: 'Add food' })).toBeVisible()
    await page.goBack()
    await page.waitForTimeout(500)
    const url = page.url()
    const problems: string[] = []
    if (!/\/sim(\?|$)/.test(new URL(url).pathname + new URL(url).search)) problems.push(`Back left the stage, to ${url}`)
    else if (await page.getByRole('dialog', { name: 'Add food' }).isVisible()) problems.push('Back left the sheet open')
    redCheck('B6', problems)
  })

  test('B10 projector mode on a phone: menu closes, Energy tab not clipped', async ({ page }) => {
    await page.goto('/sim')
    await stageReady(page)
    const menu = page.getByRole('button', { name: 'Menu' })
    await menu.click()
    await page.getByRole('button', { name: 'Projector mode' }).filter({ visible: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    await page.waitForTimeout(500)
    const problems: string[] = []
    if ((await menu.getAttribute('aria-expanded')) === 'true') problems.push('the menu stays open after switching projector mode on')
    const vw = await page.evaluate(() => document.documentElement.clientWidth)
    for (const tab of await page.getByRole('tab').filter({ visible: true }).all()) {
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
    redCheck('B10', problems)
  })
})

test.describe('phone landscape and 200 % zoom', () => {
  test.use(phone(640, 360))

  test('B3 the body shows in landscape and at 200 % zoom (≥ 160 px)', async ({ page }) => {
    const problems: string[] = []
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
    redCheck('B3', problems)
  })
})

test.describe('projector', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test.beforeEach(async ({ page }) => projectorOn(page))

  test('B12 the body is ≥ 40 % of the stage with a kept meal, EN and HI', async ({ page }) => {
    const problems: string[] = []
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
    redCheck('B12', problems)
  })

  test('B13 Hindi projector timeline ticks are ≥ 8 px apart', async ({ page }) => {
    await page.goto(`${KEPT}&lang=hi`)
    await skipWithoutHindi(page)
    await stageReady(page)
    const boxes = await page.locator('[data-tick]').evaluateAll((els) =>
      els
        .filter((e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
        .map((e) => ({ text: e.textContent ?? '', l: e.getBoundingClientRect().left, r: e.getBoundingClientRect().right }))
        .sort((a, b) => a.l - b.l),
    )
    const problems: string[] = []
    for (let i = 1; i < boxes.length; i++) {
      const gap = boxes[i]!.l - boxes[i - 1]!.r
      if (gap < 8) problems.push(`"${boxes[i - 1]!.text}" and "${boxes[i]!.text}" ${gap.toFixed(1)} px apart`)
    }
    redCheck('B13', problems)
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('B15 with 6 foods every chip is visible or counted', async ({ page }) => {
    const problems: string[] = []
    for (const w of [1440, 360]) {
      await page.setViewportSize({ width: w, height: w > 400 ? 900 : 640 })
      await page.goto(SIX_FOODS)
      await stageReady(page)
      const chips = await page.locator('section[aria-labelledby="meal-bar-title"] ul > li').evaluateAll((els) => {
        const strip = els[0]?.parentElement?.getBoundingClientRect()
        return els.map((e) => {
          const r = e.getBoundingClientRect()
          return !!strip && r.left >= strip.left - 1 && r.right <= strip.right + 1
        })
      })
      const shown = chips.filter(Boolean).length
      const counted = await page
        .locator('section[aria-labelledby="meal-bar-title"]')
        .getByText(/^\+\d+$/)
        .count()
      if (chips.length !== 6) problems.push(`${w} px: ${chips.length} chips for 6 foods`)
      else if (shown < 6 && !counted) problems.push(`${w} px: ${shown} of 6 chips wholly visible, no "+n" count`)
    }
    redCheck('B15', problems)
  })

  test('B18 the clock keeps pace when frames are slow (250 ms)', async ({ page }) => {
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
    redCheck(
      'B18',
      ratio < 0.9
        ? [
            `with 250 ms frames the clock runs at ${Math.round(100 * ratio)} % of its pace (${slow.toFixed(1)} vs ${normal.toFixed(1)} sim min/s)`,
          ]
        : [],
    )
  })

  test('B19 no console errors or warnings on /sim', async ({ page }) => {
    const console = watchConsole(page)
    await page.goto('/sim')
    await stageReady(page)
    await expect(page.locator('[data-body="3d"]')).toBeVisible()
    await page.getByRole('button', { name: 'Play' }).click()
    await page.waitForTimeout(1500)
    redCheck('B19', [...new Set(console.problems())])
  })

  test('B20 the Privacy page has no placeholder', async ({ page }) => {
    const problems: string[] = []
    for (const url of ['/privacy', '/privacy?lang=hi']) {
      await page.goto(url)
      await page.locator('main h1').waitFor()
      const text = await page.locator('main').innerText()
      for (const m of text.match(/<[^<>\n]{2,40}>/g) ?? []) problems.push(`${url}: "${m}"`)
    }
    redCheck('B20', problems)
  })

  test('B21 a link that is changed on load says so', async ({ page }) => {
    const problems: string[] = []
    for (const [link, what] of [
      ['/sim?v=2&a=cola:999', 'a'],
      ['/sim?v=2&a=water:1,milk:1,roti:1,dal:1,apple:1,banana:1,cola:1,fries:1', 'a'],
      ['/sim?v=2&a=cola:1&t=99999', 't'],
    ] as const) {
      const changed = await linkRoundTripProblems(page, link)
      const notes = await page.locator('[data-stage] [role="note"]').count()
      if (changed.some((c) => c.startsWith(`${what}=`)) && !notes) problems.push(`${link}: ${changed.join('; ')}, and no note says so`)
    }
    redCheck('B21', problems)
  })

  test('B22 lang is written only when chosen', async ({ page }) => {
    const changed = await linkRoundTripProblems(page, '/sim?v=2&a=cola:1')
    redCheck(
      'B22',
      changed.filter((c) => c.startsWith('lang=')),
    )
  })

  test('B23 Teach step 2 matches the lesson link (opens at 35 min)', async ({ page }) => {
    await page.goto('/teach')
    const lesson = page.locator('main a[href*="/sim?"]').first()
    await expect(lesson).toBeVisible()
    const t = new URL((await lesson.getAttribute('href'))!, 'http://x').searchParams.get('t')
    const step2 = await page.locator('main ol > li').nth(1).innerText()
    const problems: string[] = []
    if (t && Number(t) > 0 && !/Home/.test(step2))
      problems.push(`the lesson opens at ${t} min, but step 2 ("${step2.slice(0, 60)}…") says only "press Play"`)
    redCheck('B23', problems)
  })

  test('B24 the report form shows one privacy warning', async ({ page }) => {
    await page.goto('/sim')
    await stageReady(page)
    await page.getByRole('button', { name: 'Report a mistake' }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog').filter({ hasText: /public/i })
    await expect(dialog).toBeVisible()
    const warnings = await dialog.getByText(/\bpublic\b/i).count()
    redCheck('B24', warnings > 1 ? [`${warnings} privacy warnings in the report form`] : [])
  })

  test('B25 no dead store actions (swapKept)', async () => {
    const src = path.join(web, 'src')
    const files = (fs.readdirSync(src, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => fs.readFileSync(path.join(src, f), 'utf8'))
    const uses = files.reduce((n, text) => n + (text.match(/\bswapKept\b/g)?.length ?? 0), 0)
    // Two mentions are its type and its definition in state/run.ts; any more is a caller.
    redCheck('B25', uses > 0 && uses <= 2 ? ['swapKept is defined in state/run.ts but nothing calls it'] : [])
  })
})
