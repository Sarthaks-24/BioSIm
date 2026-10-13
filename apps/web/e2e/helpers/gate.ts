import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Release-gate helpers (roadmap A9, A11 and the v2.0 gate table).
 *
 * Every check runs in one of two modes:
 * - "enforce": a problem fails the test.
 * - "report": a problem is printed as a `[gate]` line and added to the test's annotations, and
 *   the test still passes. v1 pages run in this mode: they were not built for the gate.
 *
 * GATE_ROUTES says which page each check runs on and in which mode. A page that does not exist
 * yet is "pending" and its test is marked fixme. When a WP makes a page pass a check, it flips
 * that one entry to "enforce".
 */

export type Mode = 'report' | 'enforce'
/** "pending:WP-11" = the page is not built yet; the test is fixme until that WP. */
export type Plan = Mode | `pending:${string}`
export interface GateRoute {
  url: string
  plan: Plan
}

/** v1 simulator with a small, fixed comparison, and the accessible name of its first body. */
export const V1_SIM = '/sim?v=2&a=cola:1&b=water:1'
export const V1_BODY = 'Meal A: Cola'
/** The v2 stage: a bare /next opens the default meal, cola; this is its body's accessible name. */
export const NEXT_BODY = 'The body, digesting Cola'

/** The accessible name of the (first) body picture on a gate page. */
export const bodyName = (url: string) => (url.startsWith('/next') ? NEXT_BODY : V1_BODY)

export const GATE_ROUTES = {
  /** No page scroll at 1280×800 and 1440×900 (projects desktop, projector). */
  noScroll: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'enforce' },
    { url: '/next?lang=hi', plan: 'enforce' },
  ],
  /** Body, one graph and Play in the first phone screen, 390×844 (project phone). */
  firstScreen: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
  /**
   * No clipped text, in Hindi and in the +40 % pseudo-locale (WP-18; hindi.spec.ts runs /next in
   * English, Hindi and the pseudo-locale, with and without a kept meal, at 390, 1280, 1440 and on
   * the projector).
   */
  clippedText: [
    { url: `${V1_SIM}&lang=hi`, plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
  /**
   * Reduced motion: no auto-play, and a paused page draws no frames (project reduced).
   * WP-08 built the clock and motion stores (state/clock.ts, state/motion.ts; their unit tests
   * check that a paused clock asks for no frames). /next is the first page that uses them (WP-11).
   */
  reducedMotion: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
  /**
   * 30 fps while playing, flat body, 6× CPU throttle (project perf). /next stays "report" after
   * WP-16: on the build machine its median moved from ~21 to 23–32 fps, but the number swings by
   * ±5 with whatever else the machine runs, so enforcing it would fail at random. The real 2 GB
   * phone (docs/PHONE-CHECK.md) is the check that counts until it is steady.
   */
  fps: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'report' },
  ],
  /** Works offline after the first visit. */
  offline: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
  /** The stage draws a body and plays, in 3D and in the flat fallback (stage.spec.ts projects). */
  stage: [
    { url: V1_SIM, plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
  /** axe: no serious or critical issues. v1 pages still fail on critical ones (WP-03). */
  axe: [
    { url: '/', plan: 'report' },
    { url: V1_SIM, plan: 'report' },
    { url: '/teach', plan: 'report' },
    { url: '/science', plan: 'report' },
    { url: '/about', plan: 'report' },
    { url: '/privacy', plan: 'report' },
    { url: '/next', plan: 'enforce' },
  ],
} satisfies Record<string, GateRoute[]>

/** The mode for a route, or marks the running test fixme if the page is still pending. */
export function modeFor(route: GateRoute): Mode {
  if (route.plan.startsWith('pending:')) test.fixme(true, `${route.url} is built in ${route.plan.slice(8)}`)
  return route.plan as Mode
}

/** Only run the current test in these projects (one spec file serves several projects). */
export function onlyIn(...projects: string[]) {
  const name = test.info().project.name
  test.skip(!projects.includes(name), `runs in ${projects.join(', ')}`)
}

/** Fails (enforce) or prints (report) a list of problems found by a check. */
export function verdict(check: string, mode: Mode, problems: string[]) {
  const info = test.info()
  const line = problems.length ? `${check}: ${problems.length} problem(s): ${problems.join(' | ')}` : `${check}: ok`
  info.annotations.push({ type: mode === 'enforce' ? 'gate' : 'gate-report', description: line })
  console.log(`[gate ${mode}] ${info.project.name} ${line}`)
  if (mode === 'enforce') expect(problems, check).toEqual([])
}

/**
 * Runs steps that use `expect`. In report mode a failing step is printed instead of failing the
 * test, so a check written once can watch a v1 page and later guard a new one.
 */
export async function gateSteps(check: string, mode: Mode, steps: () => Promise<void>) {
  if (mode === 'enforce') return steps().then(() => verdict(check, mode, []))
  try {
    await steps()
    verdict(check, mode, [])
  } catch (e) {
    // The first lines of an expect() failure say what was expected, where, and what was found.
    const message = String(e instanceof Error ? e.message : e).replace(/\u001b\[\d+m/g, '')
    const lines = message
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    verdict(check, mode, [lines.slice(0, 4).join(' / ')])
  }
}

/** The page fits the window: no vertical (or sideways) scrolling. */
export async function expectNoPageScroll(page: Page, { mode = 'enforce' }: { mode?: Mode } = {}) {
  const m = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerHeight: window.innerHeight,
  }))
  const problems: string[] = []
  if (m.scrollHeight > m.innerHeight) problems.push(`page is ${m.scrollHeight}px tall in a ${m.innerHeight}px window`)
  if (m.scrollWidth > m.clientWidth) problems.push(`page is ${m.scrollWidth}px wide in a ${m.clientWidth}px window`)
  verdict('no page scroll', mode, problems)
}

/** Each named element is visible and wholly inside the first screen, before any scrolling. */
export async function expectInFirstScreen(page: Page, targets: Record<string, Locator>, { mode = 'enforce' }: { mode?: Mode } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const problems: string[] = []
  for (const [name, locator] of Object.entries(targets)) {
    const el = locator.first()
    try {
      await el.waitFor({ state: 'visible', timeout: 10_000 })
    } catch {
      problems.push(`${name} is not visible`)
      continue
    }
    const box = await el.boundingBox()
    if (!box) problems.push(`${name} has no box`)
    else if (box.x < 0 || box.y < 0 || box.x + box.width > width + 1 || box.y + box.height > height + 1) {
      problems.push(`${name} at y ${Math.round(box.y)}–${Math.round(box.y + box.height)} is outside the ${width}×${height} screen`)
    }
  }
  verdict('in the first screen', mode, problems)
}

/**
 * No text is cut off: an element that hides its overflow (or ends in an ellipsis, or is
 * line-clamped) while its content is wider or taller than it. Visually hidden helpers (sr-only:
 * 1 px, clipped) are skipped, since they clip on purpose, and so is a text marked
 * `data-may-shorten` whose whole text is in the name of the control around it (a meal chip's
 * food name gives way before its servings and ✕, council MUST 9).
 */
export async function expectNoClippedText(page: Page, { mode = 'enforce' }: { mode?: Mode } = {}) {
  const problems = await page.evaluate(() => {
    const found: string[] = []
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      if (el instanceof SVGElement || el.closest('svg, canvas')) continue
      const text = el.textContent?.trim()
      if (!text || el.clientWidth <= 1 || el.clientHeight <= 1) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.clip !== 'auto' || cs.clipPath !== 'none') continue
      const hides = (v: string) => v === 'hidden' || v === 'clip'
      const sideways = (hides(cs.overflowX) || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1
      const clamped = cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1
      if (!sideways && !clamped) continue
      if (el.hasAttribute('data-may-shorten') && el.closest('[aria-label]')?.getAttribute('aria-label')?.includes(text)) continue
      const name = el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '')
      found.push(`${name} "${text.slice(0, 40)}" (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`)
    }
    return found
  })
  verdict('no clipped text', mode, problems)
}

/**
 * Frames per second the page managed over `ms`, counted as requestAnimationFrame callbacks. A busy
 * main thread delays them, so this falls when drawing a frame takes too long.
 */
export function measureFps(page: Page, ms: number): Promise<number> {
  return page.evaluate(
    (ms) =>
      new Promise<number>((resolve) => {
        let frames = 0
        let start = 0
        const tick = (now: number) => {
          if (!start) start = now
          else frames++
          if (now - start >= ms) resolve((frames * 1000) / (now - start))
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

/**
 * Counts every requestAnimationFrame call the app makes. Install before `page.goto`, then read
 * with `appFramesDuring`. Needed for "a paused page draws no frames".
 */
export async function installFrameCounter(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __gateFrames: number }
    w.__gateFrames = 0
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => {
      w.__gateFrames++
      return raf(cb)
    }
  })
}

/** How many frames the app asked for during the next `ms` milliseconds. */
export async function appFramesDuring(page: Page, ms: number): Promise<number> {
  const read = () => page.evaluate(() => (window as unknown as { __gateFrames: number }).__gateFrames)
  const before = await read()
  await page.waitForTimeout(ms)
  return (await read()) - before
}

type Impact = 'minor' | 'moderate' | 'serious' | 'critical'

/**
 * axe (WCAG 2.1 A and AA rules). Serious and critical issues are the gate. In report mode they
 * are printed, and `failOn` still fails the test on the impacts it lists (v1 pages: critical).
 * The full axe result is attached to the test report either way.
 */
export async function checkAxe(page: Page, { mode = 'enforce', failOn = [] }: { mode?: Mode; failOn?: Impact[] } = {}) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  await test.info().attach('axe-violations.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' })
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const line = (v: (typeof serious)[number]) => `${v.impact} ${v.id} ×${v.nodes.length} (${v.help}) e.g. ${v.nodes[0]?.target.join(' ')}`
  verdict('axe serious/critical', mode, serious.map(line))
  if (mode === 'report' && failOn.length) {
    const blocking = serious.filter((v) => failOn.includes(v.impact as Impact)).map(line)
    expect(blocking, `axe ${failOn.join('/')} issues`).toEqual([])
  }
}
