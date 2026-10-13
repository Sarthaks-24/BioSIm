import { expect, test, type Page } from '@playwright/test'
import { pseudoText } from '../src/i18n/pseudo.ts'
import { onlyIn } from './helpers/gate.ts'
import { greyPixels } from './helpers/png.ts'

// The live graphs on /sim (WP-12, WP-13): one time axis shared with the dock, fixed y scales, a
// kept run that reads without colour, and energy in vs used. Projects desktop and projector.
// On the projector (and on short screens and phones) the graphs show one at a time, by tabs.

/** The graph `name` (its tab, if the graphs show one at a time), as a figure locator. */
async function graph(page: Page, name: string, tab = name) {
  await page.locator('figure [data-line="run"]').first().waitFor()
  const tabs = page.getByRole('group', { name: /^(Graphs|ग्राफ)/ })
  if (await tabs.isVisible()) await tabs.getByRole('button', { name: tab, exact: true }).click()
  const figure = page.getByRole('figure', { name, exact: true })
  await expect(figure.locator('[data-line="run"]')).toBeAttached()
  return figure
}

/** Moves the meal clock with the dock's slider keys (Home, then 10 min per →, 1 h per Shift+→, End). */
async function setTime(page: Page, keys: string[]) {
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await slider.focus()
  await page.keyboard.press('Home')
  for (const k of keys) await page.keyboard.press(k)
}

/** Horizontal centre of the first visible element matching `selector`. */
async function centreX(page: Page, selector: string) {
  const box = await page.locator(selector).filter({ visible: true }).first().boundingBox()
  expect(box, selector).not.toBeNull()
  return box!.x + box!.width / 2
}

test('the playhead on every graph stands over the dock thumb (within 1 px, 3 widths)', async ({ page }) => {
  await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1')
  await expect(page.locator('[data-line="run"]').first()).toBeAttached()
  const times: Record<string, string[]> = {
    '0 min': [],
    '30 min': ['ArrowRight', 'ArrowRight', 'ArrowRight'],
    '3 h': ['Shift+ArrowRight', 'Shift+ArrowRight', 'Shift+ArrowRight'],
    '12 h': Array<string>(12).fill('Shift+ArrowRight'),
    '48 h': ['End'],
  }
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    for (const [label, keys] of Object.entries(times)) {
      await setTime(page, keys)
      await expect
        .poll(async () => {
          const thumb = await centreX(page, '[data-thumb]')
          const heads = page.locator('[data-playhead]').filter({ visible: true })
          const xs: number[] = []
          for (let i = 0; i < (await heads.count()); i++) {
            const box = (await heads.nth(i).boundingBox())!
            xs.push(Math.abs(box.x + box.width / 2 - thumb))
          }
          return xs.length > 0 && Math.max(...xs) <= 1
        }, `${size.width}px wide, at ${label}`)
        .toBe(true)
    }
  }
})

test('the blood-sugar scale is 60 to 200 mg/dL for cola and for a burger (no rescaling)', async ({ page }) => {
  for (const meal of ['cola:1', 'cheeseburger:1', 'cheeseburger:1,fries:1&b=cola:1']) {
    await page.goto(`/sim?v=3&a=${meal}`)
    const axis = (await graph(page, 'Blood sugar')).locator('[data-axis="y"] span')
    await expect(axis.first()).toHaveText('200')
    await expect(axis.last()).toHaveText('60')
  }
})

test('the kept run reads in greyscale: a dashed line, named "Kept: …" in the legend', async ({ page }) => {
  // Water keeps blood sugar flat at the before-meal level, so the kept cola's rise stands alone.
  await page.goto('/sim?v=3&a=water:1&b=cola:1')
  const strip = await graph(page, 'Blood sugar')
  await expect(strip.getByText('Kept: Cola', { exact: true })).toBeVisible()
  const svg = strip.locator('svg[role="img"]')
  await expect(svg.locator('[data-line="kept"]')).toBeAttached()

  // Points along the kept line (page pixels), where it is clearly away from this run's line.
  const points = await svg.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const kept = el.querySelector<SVGPathElement>('[data-line="kept"]')!
    const run = el.querySelector<SVGPathElement>('[data-line="run"]')!
    const runY = run.getPointAtLength(run.getTotalLength() / 2).y
    const out: { x: number; y: number }[] = []
    for (let l = 0; l < kept.getTotalLength(); l += 0.5) {
      const p = kept.getPointAtLength(l)
      if (p.x > 10 && Math.abs(p.y - runY) > 6) out.push({ x: box.x + p.x, y: box.y + p.y })
    }
    return out
  })
  expect(points.length, 'kept line points away from the live line').toBeGreaterThan(60)

  const box = (await svg.boundingBox())!
  const shot = await page.screenshot({ clip: box, style: 'html { filter: grayscale(1) }' })
  const img = greyPixels(shot)
  const scale = img.width / box.width
  const inked = points.map((p) => img.grey((p.x - box.x) * scale, (p.y - box.y) * scale) < 170)

  // Dark enough to see without colour, and broken into dashes (6 on, 4 off).
  const share = inked.filter(Boolean).length / inked.length
  const gaps = inked.filter((ink, i) => i > 0 && !ink && inked[i - 1]).length
  expect(share, 'share of the kept line that is inked').toBeGreaterThan(0.35)
  expect(share, 'share of the kept line that is inked').toBeLessThan(0.85)
  expect(gaps, 'gaps between dashes').toBeGreaterThanOrEqual(5)
})

test('the stomach scale is 0 to 600 g for everyday meals, and stretches once for a very big one', async ({ page }) => {
  for (const meal of ['cola:1', 'roti:2,dal:1,milk:1', 'cheeseburger:1,fries:1&b=cola:1']) {
    await page.goto(`/sim?v=3&a=${meal}`)
    const strip = await graph(page, 'Food in the stomach', 'Stomach')
    await expect(strip.locator('[data-axis="y"] span').first()).toHaveText('600')
    await expect(strip.getByText('Scale stretched to fit this meal')).toHaveCount(0)
  }
  await page.goto('/sim?v=3&a=cola:4')
  const strip = await graph(page, 'Food in the stomach', 'Stomach')
  await expect(strip.locator('[data-axis="y"] span').first()).toHaveText('1,400')
  await expect(strip.getByText('Scale stretched to fit this meal')).toBeVisible()
})

test('energy: coming in vs used at rest on one kcal/h axis, with totals, and no ghost for "used"', async ({ page }) => {
  for (const meal of ['cola:1', 'cheeseburger:1,fries:1&b=cola:1', 'water:1']) {
    await page.goto(`/sim?v=3&a=${meal}`)
    const strip = await graph(page, 'Energy')
    // One fixed axis for every meal, never an empty frame: both lines are drawn.
    const axis = strip.locator('[data-axis="y"] span')
    await expect(axis.first()).toHaveText('200')
    await expect(axis.last()).toHaveText('0')
    await expect(strip.locator('[data-line="run"]')).toHaveCount(1)
    await expect(strip.locator('[data-line="second"]')).toHaveCount(1)
    // The kept meal gets a ghost for "coming in" only: "used" is the same for every meal.
    await expect(strip.locator('[data-line="kept"]')).toHaveCount(meal.includes('&b=') ? 1 : 0)
    // Each line says how sure we are; "used" is a model estimate, the same for every meal.
    await expect(strip.locator('[data-status="simulated"]')).toHaveCount(1)
    await expect(strip.locator('[data-status="assumption"]')).toHaveCount(1)
    await expect(strip.getByText('The same for every meal (resting body)')).toBeVisible()
  }

  // Readouts at the playhead: rates and running totals. The resting body uses about 63 kcal/h.
  await page.goto('/sim?v=3&a=roti:2,dal:1')
  const strip = await graph(page, 'Energy')
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await slider.focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight')
  const readouts = strip.locator('figcaption')
  await expect(readouts).toContainText(/Coming in\s*\d+ kcal\/h\s*\(\d+ kcal so far\)/)
  await expect(readouts).toContainText(/Used\s*65 kcal\/h\s*\(250 kcal so far\)/)

  // Described, never scored: the summary ends with the G6 sentence.
  await expect(strip).toHaveAccessibleDescription(
    /^In the first 6 h, about \d+ kcal from this meal entered the body, and the resting body used about 375 kcal\. When more comes in than is used, the body stores the extra for later\.$/,
  )
})

// Council 2026-10-13 #7 (WP-17): on the projector ONE graph shows at a time, big enough for the
// back row: its plot at least 250 px tall at 1280 × 800, with a kept meal, in English and Hindi.
test('on the projector the graphs show one at a time, each plot at least 250 px tall (EN and HI)', async ({ page }) => {
  onlyIn('projector')
  for (const [url, tabs] of [
    ['/sim?v=3&a=cheeseburger:1,fries:1&b=cola:1', ['Stomach', 'Blood sugar', 'Energy']],
    ['/sim?v=3&a=cheeseburger:1,fries:1&b=cola:1&lang=hi', ['आमाशय', 'रक्त शर्करा', 'ऊर्जा']],
  ] as const) {
    await page.goto(url)
    // The first-visit medical note sits above the stage until it is closed, once per device; the
    // teacher closes it before the lesson (it still fits: no scroll, gate.spec.ts).
    const group = page.getByRole('group', { name: /^(Graphs|ग्राफ)/ })
    await expect(group).toBeVisible()
    const ok = page.getByRole('button', { name: /^(Got it|ठीक है)$/ })
    if (await ok.isVisible()) await ok.click()
    for (const tab of tabs) {
      await group.getByRole('button', { name: tab, exact: true }).click()
      const plots = page.locator('figure svg[role="img"]').filter({ visible: true })
      await expect(plots).toHaveCount(1)
      // The plot re-measures after the tab changes (ResizeObserver): wait for its settled height.
      await expect
        .poll(async () => (await plots.first().boundingBox())!.height, { message: `${tab}: plot height` })
        .toBeGreaterThanOrEqual(250)
      // The tab names the graph: no title repeating it above the plot ("Energy" twice).
      const title = page.locator('figure figcaption > span[id]').filter({ visible: true }).first()
      expect((await title.boundingBox())!.width, `${tab}: title shown only to screen readers`).toBeLessThanOrEqual(1)
    }
  }
})

test('at 1440 × 900 the three graphs are stacked, each plot at least 90 px tall (EN and HI)', async ({ page }) => {
  onlyIn('desktop')
  for (const url of ['/sim?v=3&a=cheeseburger:1,fries:1&b=cola:1', '/sim?v=3&a=cheeseburger:1,fries:1&b=cola:1&lang=hi']) {
    await page.goto(url)
    // The first-visit medical note takes room above the stage until it is dismissed (once).
    await page.locator('figure [data-line="run"]').first().waitFor()
    const ok = page.getByRole('button', { name: /^(Got it|ठीक है)$/ })
    if (await ok.isVisible()) await ok.click()
    await expect(page.getByRole('group', { name: /^(Graphs|ग्राफ)/ })).toBeHidden()
    const plots = page.locator('figure svg[role="img"]').filter({ visible: true })
    await expect(plots).toHaveCount(3)
    for (const box of await Promise.all((await plots.all()).map((p) => p.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(90)
    // Each graph says once how sure we are, by its title, smaller and lighter than the legend, so
    // it does not read as one more line of the legend (council SHOULD 10).
    for (const figure of await page
      .locator('figure')
      .filter({ has: page.locator('svg[role="img"]') })
      .all()) {
      expect((await figure.locator('figcaption > span[id]').boundingBox())!.width).toBeGreaterThan(1)
      const status = figure.locator('figcaption > [class*="grid-area:status"] [data-status]')
      await expect(status).toHaveCount(1)
      const px = (l: typeof status) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      // Hindi captions never go below 14 px, so there it is the same size, but not bold.
      const legend = await px(figure.locator('figcaption [class*="grid-area:read"]').first())
      if (url.endsWith('lang=hi')) expect(await px(status)).toBeLessThanOrEqual(legend)
      else expect(await px(status)).toBeLessThan(legend)
      expect(await status.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400')
    }
  }
})

/**
 * Every visible piece of text in the visible graphs that touches a drawn line (within 1 px), as
 * "words" touches the run line. Lines are read from their path data (straight segments, lib/axis
 * linePath) and checked against each text box exactly: no sampling, so it is fast under load.
 */
function wordsOnLines(figures: Element[]) {
  const out: string[] = []
  // True when segment (x1, y1)–(x2, y2) crosses the box (Liang–Barsky).
  const crosses = (b: DOMRect, x1: number, y1: number, x2: number, y2: number) => {
    let t0 = 0
    let t1 = 1
    const dx = x2 - x1
    const dy = y2 - y1
    for (const [p, q] of [
      [-dx, x1 - (b.left - 1)],
      [dx, b.right + 1 - x1],
      [-dy, y1 - (b.top - 1)],
      [dy, b.bottom + 1 - y1],
    ] as const) {
      if (p === 0) {
        if (q < 0) return false
      } else if (p < 0) t0 = Math.max(t0, q / p)
      else t1 = Math.min(t1, q / p)
      if (t0 > t1) return false
    }
    return true
  }
  for (const fig of figures) {
    const svg = fig.querySelector('svg[role="img"]')
    if (!svg) continue
    const origin = svg.getBoundingClientRect()
    const lines = [...svg.querySelectorAll<SVGPathElement>('[data-line="run"], [data-line="kept"], [data-line="second"]')].map((path) => {
      const n = (path.getAttribute('d')!.match(/-?[\d.]+/g) ?? []).map(Number)
      const pts: number[] = []
      for (let i = 0; i + 1 < n.length; i += 2) pts.push(origin.x + n[i]!, origin.y + n[i + 1]!)
      return { name: path.dataset.line!, pts }
    })
    const walker = document.createTreeWalker(fig, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement!
      if (!text || el.closest('[hidden], .sr-only') || getComputedStyle(el).visibility === 'hidden') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue
        const hit = lines.find(({ pts }) => {
          for (let i = 2; i + 1 < pts.length; i += 2) if (crosses(r, pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!)) return true
          return false
        })
        if (hit) out.push(`"${text}" touches the ${hit.name} line`)
      }
    }
  }
  return out
}

// B14 (FP-4): no word on a graph sits on a line, with a kept meal, stacked (1280) and under tabs
// (390), in English and Hindi. One test per window and language, so each has its own time.
for (const size of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  for (const lang of ['en', 'hi']) {
    test(`no words on a graph touch a line, and the legend names both meals (${size.width}, ${lang})`, async ({ page }) => {
      onlyIn('desktop')
      await page.setViewportSize(size)
      const meals = [
        'cola:1&b=cheeseburger:1,fries:1',
        'cheeseburger:1,fries:1&b=cola:1',
        'roti:2,dal:1&b=white-rice:1',
        'cola:4&b=cola:1',
        'water:1&b=orange-juice:1',
      ]
      for (const meal of meals) {
        await page.goto(`/sim?v=3&a=${meal}&lang=${lang}`)
        await page.locator('figure [data-line="run"]').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        const tabs = page.getByRole('group', { name: /^(Graphs|ग्राफ)/ })
        const tabNames = (await tabs.isVisible()) ? await tabs.getByRole('button').allTextContents() : ['']
        for (const tab of tabNames) {
          if (tab) await tabs.getByRole('button', { name: tab, exact: true }).click()
          const where = `${size.width}px, ${lang}, ${meal}${tab ? `, ${tab}` : ''}`
          // Labels are placed before paint, and re-placed when a font arrives: poll until none touches a line.
          await expect.poll(() => page.locator('figure').filter({ visible: true }).evaluateAll(wordsOnLines), { message: where }).toEqual([])
          // The legend says which line is which meal: never a bare "Kept" or a word at a line's end.
          const kept = lang === 'en' ? /^Kept: / : /^रखा गया भोजन: /
          await expect(page.locator('figure figcaption').filter({ visible: true }).first().getByText(kept)).toBeVisible()
        }
      }
    })
  }
}

// Council round 2, C2: after a big meal every graph fell "off a cliff" at 6 h. It is steady
// emptying ending soon after 6 h, drawn on the squeezed part of the axis: each graph tints that
// part from the knee to the end and breaks its x axis there.
test('every graph shows where time is squeezed: a tint from 6 h to the end and a break in the axis', async ({ page }) => {
  await page.goto('/sim?v=3&a=cheeseburger:1,fries:1&t=420')
  for (const name of ['Food in the stomach', 'Blood sugar', 'Energy']) {
    const figure = await graph(page, name, { 'Food in the stomach': 'Stomach' }[name] ?? name)
    const plot = (await figure.locator('svg[role="img"]').boundingBox())!
    const tint = (await figure.locator('[data-squeezed]').boundingBox())!
    // The knee is 60 % of the way along the plot, as on the dock (lib/time.ts).
    expect(Math.abs(tint.x - (plot.x + 0.6 * plot.width)), `${name}: tint starts at 6 h`).toBeLessThanOrEqual(1)
    expect(Math.abs(tint.x + tint.width - (plot.x + plot.width)), `${name}: tint runs to 48 h`).toBeLessThanOrEqual(1)
    expect(tint.height).toBeCloseTo(plot.height, 0)
    await expect(figure.locator('[data-axis-break]')).toBeAttached()
  }
})

// Council round 2, C3, C5, C6.
test('the ring’s label names its meal beside a kept one, and sits above the playhead', async ({ page }) => {
  await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1&t=40')
  const figure = await graph(page, 'Food in the stomach', 'Stomach')
  const label = figure.locator('[data-plot-label="marker"]')
  await expect(label).toHaveText('Cola: half the energy has left the stomach')
  // Painted over the playhead (which may pass behind it), never under its line.
  expect(await label.evaluate((el) => getComputedStyle(el).zIndex)).toBe('10')
  await page.goto('/sim?v=3&a=cola:1&t=40')
  await expect((await graph(page, 'Food in the stomach', 'Stomach')).locator('[data-plot-label="marker"]')).toHaveText(
    'Half the energy has left the stomach',
  )
})

test('graphs under tabs write their unit at the top of the y axis', async ({ page }) => {
  onlyIn('projector')
  await page.goto('/sim?v=3&a=cola:1')
  for (const [tab, unit] of [
    ['Stomach', 'g'],
    ['Blood sugar', 'mg/dL'],
    ['Energy', 'kcal/h'],
  ] as const) {
    await page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name: tab, exact: true }).click()
    await expect(page.locator('figure [data-plot-label="unit"]').filter({ visible: true })).toHaveText(unit)
  }
})

// B10 (FP-4 part): projector mode on a phone keeps the tabs at their usual size, so all three show
// whole, with no sideways scroll (at title size "Energy" was cut at 390 px).
test('projector mode on a 390 px phone: every graph tab shows whole', async ({ page }) => {
  onlyIn('projector')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1')
  const group = page.getByRole('group', { name: 'Graphs' })
  await expect(group.getByRole('button')).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
  const clipped = await group.evaluate((g) => {
    const box = g.getBoundingClientRect()
    const out = [...g.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().right > box.right + 1 || b.scrollWidth > b.clientWidth + 1)
      .map((b) => b.textContent)
    return g.scrollWidth > g.clientWidth + 1 ? [...out, `the row scrolls (${g.scrollWidth} > ${g.clientWidth})`] : out
  })
  expect(clipped).toEqual([])
})

// R60: with 6 foods at 360 × 640 the stomach scale stretches; its note gets one row of its own,
// so the plot stays above the dock (it wrapped to 3 lines beside the status and slid under it).
test('a stretched scale’s note on a 360 × 640 phone is one line, and the plot stays above the dock', async ({ page }) => {
  onlyIn('desktop')
  await page.setViewportSize({ width: 360, height: 640 })
  for (const lang of ['en', 'pseudo']) {
    await page.goto(`/sim?v=2&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1&lang=${lang}`)
    await page.locator('figure [data-line="run"]').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    const figure = page.locator('figure').filter({ visible: true })
    const words = 'Scale stretched to fit this meal'
    const note = figure.getByText(lang === 'en' ? words : pseudoText(words), { exact: true })
    await expect(note).toBeVisible()
    const lineHeight = await note.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight))
    expect((await note.boundingBox())!.height, `${lang}: the note is one line`).toBeLessThanOrEqual(lineHeight * 1.5)
    const plot = (await figure.locator('svg[role="img"]').boundingBox())!
    const column = (await page.locator('section[aria-labelledby="graphs-title"]').boundingBox())!
    expect(plot.y + plot.height, `${lang}: the plot ends above the dock`).toBeLessThanOrEqual(column.y + column.height + 0.5)
    expect(plot.height, `${lang}: plot height`).toBeGreaterThanOrEqual(48)
  }
})
