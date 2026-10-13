// Main-thread CPU per frame while the stage plays (plan qa-fixes §3.4), ported from the perf probe
// cache/perf/abcpu.mjs. Shared by scripts/cpu-ratio.mjs (the A/B job: base build vs PR build) and
// e2e/perf.spec.ts (the absolute number, reported only, never gated: CI runners differ).
//
// It traces one stretch of play with the DevTools protocol and adds up the thread time (`tdur`) of
// the renderer's main thread's top-level tasks, then divides by the frames drawn. Thread time, not
// wall time, so a busy machine does not inflate it; nested events are counted once. Every thread
// of the renderer process (compositor, raster, GPU, workers) is summed beside it, reported only.

/** The stage as the A/B job measures it: the default lesson, a kept meal, so both lines draw. */
export const CPU_PATH = '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1'

/** Frames drawn and milliseconds passed over `ms` of requestAnimationFrame. */
function frames(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        let f = 0
        let s = 0
        const tick = (n) => {
          if (!s) s = n
          else f++
          if (n - s >= ms) resolve({ frames: f, ms: n - s })
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

/**
 * Plays the stage for `ms` from a start point (`round` picks it, so rounds cover the whole meal)
 * and returns main-thread and whole-renderer CPU per frame, in ms. Needs a Chromium page and a CDP
 * session on it. The page must show the stage, paused.
 */
export async function cpuPerFrame(page, cdp, { ms = 3000, round = 0 } = {}) {
  const slider = page.getByRole('slider').first()
  await slider.press('Home')
  for (let k = 0; k < (round % 3) * 3; k++) await slider.press('ArrowRight')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(200)
  const events = []
  const onData = (e) => events.push(...e.value)
  cdp.on('Tracing.dataCollected', onData)
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['toplevel', 'devtools.timeline'] },
    transferMode: 'ReportEvents',
  })
  const fr = await frames(page, ms)
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve))
  await cdp.send('Tracing.end')
  await done
  cdp.off('Tracing.dataCollected', onData)
  await page.getByRole('button', { name: 'Pause' }).click()

  const names = new Map()
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name)
  const count = new Map()
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`
    if (names.get(key) === 'CrRendererMain') count.set(key, (count.get(key) ?? 0) + 1)
  }
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!main) throw new Error('No renderer main thread in the trace')
  const pid = main.split(':')[0]
  /** Thread time of top-level events on one thread, nested ones counted once. */
  const threadTime = (key) => {
    let tdur = 0
    let end = 0
    for (const e of events.filter((x) => `${x.pid}:${x.tid}` === key && x.ph === 'X').sort((a, b) => a.ts - b.ts)) {
      if (e.ts >= end && e.tdur != null) {
        tdur += e.tdur
        end = e.ts + e.dur
      }
    }
    return tdur / 1000
  }
  const threads = new Set(events.filter((e) => String(e.pid) === pid).map((e) => `${e.pid}:${e.tid}`))
  const renderer = [...threads].reduce((sum, key) => sum + threadTime(key), 0)
  const n = Math.max(1, fr.frames)
  return { main: threadTime(main) / n, renderer: renderer / n, frames: fr.frames, ms: fr.ms }
}

/** The median (upper middle for an even count). */
export function median(values) {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** The §3.4 gate: PR median ≤ 1.10 × base median + 0.2 ms. */
export function ratioGate(base, pr) {
  const limit = 1.1 * base + 0.2
  return { limit, ratio: pr / base, pass: pr <= limit }
}
