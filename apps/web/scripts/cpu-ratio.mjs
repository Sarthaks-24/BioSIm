// The CPU regression gate (plan qa-fixes §3.4), ported from cache/perf/abcpu.mjs. Two builds are
// served (the base: the head of the branch the PR merges into; and the PR), and this plays the
// stage in each, interleaved (flat body, 1440×900, no CPU throttle), several rounds, and compares
// the medians of main-thread CPU per frame:
//
//   gate: PR median ≤ 1.10 × base median + 0.2 ms
//
// Total renderer CPU (compositor, raster, GPU, workers) is printed beside it. It is a regression
// ratchet, not a 30 fps proof: absolute numbers are only printed. For a new system layer, serve
// the same build twice and pass --pr-path with the new layer lit.
//
//   node scripts/cpu-ratio.mjs --base http://localhost:4391 --pr http://localhost:4392 [--rounds 6] [--ms 3000]
//        [--base-path /sim?...] [--pr-path /sim?...] [--enforce] [--json out.json]
//
// Report-only by default (T0): it prints the verdict and exits 0, also when it cannot measure. With
// --enforce it exits 1 when the gate fails or the run does (the CI job flips to it in T10, FP-9).
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { CPU_PATH, cpuPerFrame, median, ratioGate } from './cpu-frame.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const base = arg('base')
const pr = arg('pr')
if (!base || !pr) {
  console.error('Usage: node scripts/cpu-ratio.mjs --base <url> --pr <url> [--rounds 6] [--ms 3000] [--enforce]')
  process.exit(2)
}
const rounds = Number(arg('rounds', '6'))
const ms = Number(arg('ms', '3000'))
const enforce = process.argv.includes('--enforce')

/** The browser, so a failed run can still close it. */
let browser

/** Runs the comparison; returns the exit code. */
async function run() {
  // Flat body (no WebGL): the CPU the stage itself spends, without software-rendered 3D.
  browser = await chromium.launch({ args: ['--disable-3d-apis'] })
  const builds = []
  for (const [name, origin, path] of [
    ['base', base, arg('base-path', CPU_PATH)],
    ['pr', pr, arg('pr-path', CPU_PATH)],
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
    const page = await context.newPage()
    await page.goto(new URL(path, origin).href)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Play' }).waitFor()
    builds.push({ name, page, cdp: await context.newCDPSession(page), main: [], renderer: [] })
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Interleaved, and the order flips every round, so a slow patch of the machine hits both.
  for (let round = 0; round < rounds; round++) {
    for (const b of round % 2 ? [...builds].reverse() : builds) {
      const r = await cpuPerFrame(b.page, b.cdp, { ms, round })
      b.main.push(r.main)
      b.renderer.push(r.renderer)
    }
  }
  await browser.close()

  const fmt = (x) => x.toFixed(2)
  const [b, p] = builds.map((x) => ({ ...x, mainMed: median(x.main), rendererMed: median(x.renderer) }))
  for (const x of [b, p]) {
    console.log(
      `${x.name.padEnd(5)} main ${fmt(x.mainMed)} ms/frame (${x.main.map(fmt).join(', ')}); renderer total ${fmt(x.rendererMed)} ms/frame`,
    )
  }
  const gate = ratioGate(b.mainMed, p.mainMed)
  const line = `CPU ratio ${gate.ratio.toFixed(3)}: PR ${fmt(p.mainMed)} ms vs limit ${fmt(gate.limit)} ms (1.10 × base ${fmt(b.mainMed)} + 0.2)`
  console.log(`${gate.pass ? 'PASS' : enforce ? 'FAIL' : 'OVER (report only)'} ${line}`)
  const out = arg('json')
  if (out) {
    const result = { base: { main: b.main, renderer: b.renderer }, pr: { main: p.main, renderer: p.renderer }, ...gate, enforce }
    fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### CPU ratio (§3.4)\n\n| | main ms/frame (median) | renderer total |\n|---|---|---|\n| base | ${fmt(b.mainMed)} | ${fmt(b.rendererMed)} |\n| PR | ${fmt(p.mainMed)} | ${fmt(p.rendererMed)} |\n\n${gate.pass ? '✅' : '⚠️'} ${line}${enforce ? '' : ' — report only'}\n`,
    )
  }
  return enforce && !gate.pass ? 1 : 0
}

// Report-only means report-only: a run that cannot finish (a build that does not serve, a browser
// that does not start) is printed and exits 0; only --enforce makes it fail the job.
const code = await run().catch(async (e) => {
  await browser?.close().catch(() => {})
  const line = `CPU ratio could not be measured: ${String(e instanceof Error ? e.message : e).split('\n')[0]}`
  console.error(e)
  console.log(`${enforce ? 'FAIL' : 'ERROR (report only)'} ${line}`)
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CPU ratio (§3.4)\n\n⚠️ ${line}${enforce ? '' : ' — report only'}\n`)
  return enforce ? 1 : 0
})
process.exit(code)
