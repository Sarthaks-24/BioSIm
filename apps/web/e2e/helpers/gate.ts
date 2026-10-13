import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Release-gate helpers (roadmap A9, A11 and the v2.0 gate table).
 *
 * Every check runs in one of two modes:
 * - "enforce": a problem fails the test.
 * - "report": a problem is printed as a `[gate]` line and added to the test's annotations, and
 *   the test still passes. A page not yet built for a check runs it in this mode.
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

/** The stage: a bare /sim opens the default meal, cola; this is its body's accessible name. */
export const SIM_BODY = 'The body, digesting Cola'

/**
 * Since WP-19 the stage is /sim and every gate is enforced there. v1's own rows (its simulator,
 * report-only since WP-03) went with it; /next only redirects to /sim now.
 */
export const GATE_ROUTES = {
  /** No page scroll at 1280×800 and 1440×900 (projects desktop, projector). */
  noScroll: [
    { url: '/sim', plan: 'enforce' },
    { url: '/sim?lang=hi', plan: 'enforce' },
  ],
  /** Body, one graph and Play in the first phone screen, 390×844 (project phone). */
  firstScreen: [{ url: '/sim', plan: 'enforce' }],
  /**
   * No clipped text, in Hindi and in the +40 % pseudo-locale (WP-18; hindi.spec.ts runs /sim in
   * English, Hindi and the pseudo-locale, with and without a kept meal, at 390, 1280, 1440 and on
   * the projector).
   */
  clippedText: [{ url: '/sim', plan: 'enforce' }],
  /**
   * Reduced motion: no auto-play, and a paused page draws no frames (project reduced).
   * WP-08 built the clock and motion stores (state/clock.ts, state/motion.ts; their unit tests
   * check that a paused clock asks for no frames).
   */
  reducedMotion: [{ url: '/sim', plan: 'enforce' }],
  /**
   * 30 fps while playing, flat body, 6× CPU throttle (project perf). Still "report" after
   * WP-16: on the build machine the median moved from ~21 to 23–32 fps, but the number swings by
   * ±5 with whatever else the machine runs, so enforcing it would fail at random. The real 2 GB
   * phone (docs/PHONE-CHECK.md) is the check that counts until it is steady.
   */
  fps: [{ url: '/sim', plan: 'report' }],
  /** Works offline after the first visit. */
  offline: [{ url: '/sim', plan: 'enforce' }],
  /** The stage draws a body and plays, in 3D and in the flat fallback (stage.spec.ts projects). */
  stage: [{ url: '/sim', plan: 'enforce' }],
  /** axe: no serious or critical issues, on every page. */
  axe: [
    { url: '/', plan: 'enforce' },
    { url: '/sim', plan: 'enforce' },
    { url: '/teach', plan: 'enforce' },
    { url: '/science', plan: 'enforce' },
    { url: '/about', plan: 'enforce' },
    { url: '/privacy', plan: 'enforce' },
    { url: '/stats', plan: 'enforce' },
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
 * test, so a check written once can watch a page before it is ready and guard it after.
 */
export async function gateSteps(check: string, mode: Mode, steps: () => Promise<void>) {
  if (mode === 'enforce') return steps().then(() => verdict(check, mode, []))
  const problem = await tryStep(steps)
  verdict(check, mode, problem ? [problem] : [])
}

/**
 * Runs steps that may throw (a click, a wait, an expect) and returns what went wrong as one
 * problem line, or null if nothing did. So a report-mode check whose page is not ready reports
 * that, instead of failing its test. A skip inside the steps (test.skip) still skips the test.
 */
export async function tryStep(steps: () => Promise<void>): Promise<string | null> {
  try {
    await steps()
    return null
  } catch (e) {
    if (test.info().expectedStatus === 'skipped') throw e
    // The first lines of an expect() failure say what was expected, where, and what was found.
    const message = String(e instanceof Error ? e.message : e).replace(/\u001b\[\d+m/g, '')
    const lines = message
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.slice(0, 4).join(' / ')
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

/**
 * Waits until the body picture is drawn at its settled size: `data-ready` on the 3D body after its
 * first frame (BodyCanvas waits for a stable box and the fonts), or on the flat body when it is the
 * one shown. Until then the flat stand-in is swapped for the 3D body, and anything measured on it
 * can be detached mid-check (T7: the "body has no box" and "leader NaN" flakes). A drawn stage
 * with no body (the empty state before FP-1), or with a body squeezed to 0 px (which never draws:
 * B1 before FP-1), goes on at once; a body never ready, after `timeout`.
 */
export async function bodySettled(page: Page, timeout = 15_000) {
  await page
    .waitForFunction(
      () => {
        if (document.querySelector('[data-body][data-ready]')) return true
        if (!document.querySelector('[data-stage]')) return false
        const bodies = [...document.querySelectorAll('[data-body]')]
        return bodies.every((b) => {
          const r = b.getBoundingClientRect()
          return r.width === 0 || r.height === 0
        })
      },
      null,
      { timeout },
    )
    .catch(() => undefined)
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
 * are printed, and `failOn` still fails the test on the impacts it lists (a page in report mode: critical).
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

// ---------------------------------------------------------------------------------------------
// Track A invariants (T0; plan qa-fixes §3.2). Each returns what it found, so a spec can print it
// (report) or fail on it (enforce) with `verdict`. They start in report mode: each FP step flips
// the ones it fixes (qa-fixes §1.1 traceability table).
// ---------------------------------------------------------------------------------------------

/** A visitor who has already closed the first-run medical note. Call before `page.goto`. */
export async function returningVisitor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
}

/**
 * Hindi is paused (R47): only a VITE_HINDI=1 build has it (the e2e build does). After opening a
 * Hindi page, this skips the running test on a build without it (a deployed site).
 */
export async function skipWithoutHindi(page: Page) {
  const hindi = await page
    .waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!hindi, 'Hindi is paused (R47): this build has none')
}

/** What the body picture gets of the first screen (`measureBody`). */
export interface BodyMeasure {
  /** A body picture (`[data-body]`, flat or 3D) is on the page and laid out. */
  found: boolean
  /** The picture's box ∩ the viewport at scroll 0, in CSS px. */
  visibleWidth: number
  visibleHeight: number
  /** That visible area as a share of the viewport. */
  screenShare: number
  /** The picture's height as a share of the stage's (`[data-stage]`) height. */
  stageShare: number
  /** Share of the visible picture under other painted elements (0–1). */
  covered: number
  /** The elements that cover it most, with the share of the picture each covers. */
  coveredBy: string[]
}

/**
 * The body picture's box ∩ viewport at `scrollY = 0`, and how much of it other painted elements
 * cover (§3.2). "Covered" is the union of the boxes of every visible element painted over the
 * picture, `pointer-events: none` ones included (so no `elementFromPoint`, which skips them): an
 * element over it is one later in the document than the picture, or positioned with a z-index,
 * that paints something (its own text, a background, an image, a canvas or a control). The
 * picture's own parts (organ labels and their leader lines) are not cover. The union is sampled
 * on a 48 × 48 grid over the visible picture.
 */
export async function measureBody(page: Page): Promise<BodyMeasure> {
  await page.evaluate(() => window.scrollTo(0, 0))
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const shown = (el: Element) => {
      const s = getComputedStyle(el)
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0
    }
    // The one drawn (3D replaces the flat body once it loads); else any, even squeezed to 0 px.
    const all = [...document.querySelectorAll('[data-body]')]
    const body =
      all.find((el) => {
        const r = el.getBoundingClientRect()
        return shown(el) && r.width > 0 && r.height > 0
      }) ?? all[0]
    const out = {
      found: !!body,
      visibleWidth: 0,
      visibleHeight: 0,
      screenShare: 0,
      stageShare: 0,
      covered: 0,
      coveredBy: [] as string[],
    }
    if (!body) return out
    const b = body.getBoundingClientRect()
    const box = { left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(vw, b.right), bottom: Math.min(vh, b.bottom) }
    const w = Math.max(0, box.right - box.left)
    const h = Math.max(0, box.bottom - box.top)
    const stage = document.querySelector('[data-stage]')?.getBoundingClientRect()
    Object.assign(out, {
      visibleWidth: Math.round(w),
      visibleHeight: Math.round(h),
      screenShare: (w * h) / (vw * vh),
      stageShare: stage?.height ? b.height / stage.height : 0,
    })
    if (!w || !h) return out

    /** Alpha of a computed colour (`rgb(…)`, `rgba(…)`, `rgb(… / a)`, `transparent`). */
    const alpha = (c: string) => {
      if (c === 'transparent') return 0
      const m = /\(([^)]+)\)/.exec(c)
      const parts = m ? m[1]!.split(/[\s,/]+/).filter(Boolean) : []
      if (parts.length < 4) return 1
      const a = parts[3]!
      return a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a)
    }
    /** Positioned with a z-index, in a stacking context the body is not part of. */
    const raised = (el: Element) => {
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        if (p.contains(body)) return false
        const s = getComputedStyle(p)
        if (s.position !== 'static' && s.zIndex !== 'auto' && Number(s.zIndex) >= 0) return true
      }
      return false
    }
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`
    type Box = { left: number; top: number; right: number; bottom: number }
    const rects: { r: Box; who: string }[] = []
    const meets = (r: DOMRect) =>
      r.width > 0 && r.height > 0 && r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom
    for (const el of document.body.querySelectorAll('*')) {
      if (el === body || body.contains(el) || el.contains(body) || el.closest('.sr-only')) continue
      const r = el.getBoundingClientRect()
      if (!meets(r) || !shown(el)) continue
      const after = !!(body.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      if (!after && !raised(el)) continue
      const s = getComputedStyle(el)
      const solid =
        alpha(s.backgroundColor) > 0.05 ||
        s.backgroundImage !== 'none' ||
        el.matches('img, canvas, video, input, select, textarea, button, [role=button]') ||
        (el instanceof SVGSVGElement && !el.parentElement?.closest('svg'))
      if (solid) {
        rects.push({ r, who: name(el) })
        continue
      }
      // A transparent box covers only where its own text is drawn.
      for (const n of el.childNodes) {
        if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const tr of range.getClientRects()) if (meets(tr)) rects.push({ r: tr, who: name(el) })
      }
    }
    const N = 48
    let hit = 0
    const counts = new Map<string, number>()
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const x = box.left + ((i + 0.5) * w) / N
        const y = box.top + ((j + 0.5) * h) / N
        const over = rects.filter(({ r }) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
        if (!over.length) continue
        hit++
        for (const who of new Set(over.map((o) => o.who))) counts.set(who, (counts.get(who) ?? 0) + 1)
      }
    out.covered = hit / (N * N)
    out.coveredBy = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([who, n]) => `${who} ${Math.round((100 * n) / (N * N))} %`)
    return out
  })
}

/** Limits for `checkBody`: phones ≥ 160 px, projector ≥ 40 % of the stage, every project covered ≤ 10 %. */
export interface BodyLimits {
  minHeight?: number
  minStageShare?: number
  minScreenShare?: number
  maxCovered?: number
}

/** The body picture is big enough and not hidden (§3.2; bugs B1, B3, B12, U1, U2, U9). */
export async function checkBody(page: Page, limits: BodyLimits, { mode = 'report', label = '' }: { mode?: Mode; label?: string } = {}) {
  const m = await measureBody(page)
  const pct = (x: number) => `${Math.round(100 * x)} %`
  const problems: string[] = []
  if (!m.found) problems.push('no body picture on the page')
  else {
    if (limits.minHeight != null && m.visibleHeight < limits.minHeight)
      problems.push(`body ${m.visibleWidth}×${m.visibleHeight} px in the first screen (< ${limits.minHeight} px tall)`)
    if (limits.minStageShare != null && m.stageShare < limits.minStageShare)
      problems.push(`body is ${pct(m.stageShare)} of the stage's height (< ${pct(limits.minStageShare)})`)
    if (limits.minScreenShare != null && m.screenShare < limits.minScreenShare)
      problems.push(`body is ${pct(m.screenShare)} of the first screen (< ${pct(limits.minScreenShare)})`)
    if (limits.maxCovered != null && m.covered > limits.maxCovered)
      problems.push(`${pct(m.covered)} of the body is covered (> ${pct(limits.maxCovered)}): ${m.coveredBy.join(', ')}`)
  }
  verdict(`body visible${label ? ` (${label})` : ''}`, mode, problems)
  return m
}

/**
 * Interactive elements whose boxes overlap (ported from the QA sweep's audit.mjs). Each box is
 * first clipped to its scroll containers, so a chip scrolled out of its strip does not count.
 */
export function interactiveOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const visible = (el: Element) => {
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1
    }
    const clipped = (el: Element) => {
      const r = el.getBoundingClientRect()
      let [l, t, rt, b] = [r.left, r.top, r.right, r.bottom]
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const s = getComputedStyle(p)
        const q = p.getBoundingClientRect()
        if (s.overflowX !== 'visible') [l, rt] = [Math.max(l, q.left), Math.min(rt, q.right)]
        if (s.overflowY !== 'visible') [t, b] = [Math.max(t, q.top), Math.min(b, q.bottom)]
      }
      return { l, t, r: rt, b, w: Math.max(0, rt - l), h: Math.max(0, b - t) }
    }
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`
    const SELECTOR =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=slider], [role=tab], [role=switch]'
    const els = [...document.body.querySelectorAll(SELECTOR)].filter((el) => {
      if (!visible(el) || el.closest('.sr-only')) return false
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
    })
    const boxes = els.map((el) => ({ el, c: clipped(el) })).filter((x) => x.c.w > 1 && x.c.h > 1)
    const found: string[] = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const w = Math.min(a.c.r, b.c.r) - Math.max(a.c.l, b.c.l)
        const h = Math.min(a.c.b, b.c.b) - Math.max(a.c.t, b.c.t)
        if (w > 3 && h > 3) found.push(`${name(a.el)} × ${name(b.el)} (${Math.round(w)}×${Math.round(h)} px)`)
      }
    return found
  })
}

/**
 * An overlay (popover, sheet, dialog) is usable (§3.2; B5, U4): wholly in the viewport, below the
 * header, with a visible button named "Close" (or "बंद करें"). Returns the problems.
 */
export async function overlayProblems(page: Page, overlay: Locator): Promise<string[]> {
  const box = await overlay.boundingBox()
  if (!box) return ['the overlay has no box']
  const problems: string[] = []
  const { vw, vh, header } = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    vh: window.innerHeight,
    header: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
  }))
  const r = Math.round
  if (box.x < -1 || box.y < -1 || box.x + box.width > vw + 1 || box.y + box.height > vh + 1)
    problems.push(`overlay at ${r(box.x)},${r(box.y)} ${r(box.width)}×${r(box.height)} leaves the ${vw}×${vh} window`)
  if (box.y < header - 1) problems.push(`overlay top ${r(box.y)} is above the header's bottom ${r(header)}`)
  const close = overlay.getByRole('button', { name: /^(Close|बंद करें)/ })
  if (!(await close.first().isVisible())) problems.push('no visible "Close" button')
  return problems
}

/** Console lines that are not the app's fault (B19's THREE.Clock and preload warnings are its own). */
export const CONSOLE_ALLOW: RegExp[] = [
  // The storage-blocked project blocks the service worker on purpose (Playwright says so).
  /Service Worker registration blocked by Playwright/,
]

/** Collects console errors and warnings and page errors; `problems()` lists those not allowed. */
export function watchConsole(page: Page, allow: RegExp[] = CONSOLE_ALLOW) {
  const seen: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') seen.push(`${m.type()}: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => seen.push(`pageerror: ${String(e).slice(0, 200)}`))
  return { problems: () => seen.filter((line) => !allow.some((re) => re.test(line))) }
}

/**
 * A link survives a load (§3.2; B21, B22): the address after link-sync carries the same meal,
 * kept meal, time, person and layer as the link opened, and no `lang` the link did not have.
 */
export async function linkRoundTripProblems(page: Page, path: string): Promise<string[]> {
  await page.goto(path)
  await page.locator('[data-stage]').waitFor()
  // Link-sync writes the meal at once; the time is debounced.
  await page.waitForTimeout(800)
  const asked = new URL(path, 'http://x').searchParams
  const got = new URL(page.url()).searchParams
  const problems: string[] = []
  for (const key of ['a', 'b', 't', 'who', 'layer']) {
    const want = asked.get(key)
    if (want != null && got.get(key) !== want) problems.push(`${key}=${want} came back as ${got.get(key) ?? '(none)'}`)
  }
  if (!asked.has('lang') && got.has('lang')) problems.push(`lang=${got.get('lang')} was added to a link that had none`)
  return problems
}

/**
 * The red list (T0; qa-fixes §0, §1.1): one report test per QA-sweep bug (B1–B26) that was seen
 * failing on eee16c9 (e2e/red-list.md says which, with what was measured). "report" prints a
 * `[gate report] … red Bn` line and passes. The T-step whose FP fixes a bug flips it to "enforce";
 * from then on the test guards the fix.
 */
export const RED_LIST: Record<string, Mode> = {
  B1: 'report',
  B2: 'report',
  B3: 'report',
  B4: 'report',
  B5: 'report',
  B6: 'report',
  B7: 'report',
  B8: 'report',
  B9: 'report',
  B10: 'report',
  B11: 'report',
  B12: 'report',
  B13: 'report',
  B15: 'report',
  B18: 'enforce',
  B19: 'enforce',
  B20: 'report',
  B21: 'report',
  B22: 'report',
  B23: 'enforce',
  B24: 'enforce',
  B25: 'report',
}

/**
 * Records one red-list bug; `problems` empty = not seen in this run. It adds a `red` annotation
 * ("B1 reproduced: …" or "B1 not seen") that scripts/red-list.mjs collects into e2e/red-list.json.
 */
export function redCheck(bug: keyof typeof RED_LIST, problems: string[]) {
  const mode = RED_LIST[bug] ?? 'report'
  const seen = problems.length ? `reproduced: ${problems.join(' | ')}` : 'not seen'
  test.info().annotations.push({ type: 'red', description: `${bug} ${seen}` })
  verdict(`red ${bug}`, mode, problems)
}
