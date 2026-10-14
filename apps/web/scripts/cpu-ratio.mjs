// The CPU regression gate (plan qa-fixes §3.4), ported from cache/perf/abcpu.mjs. Two builds are
// served (the base: the head of the branch the PR merges into; and the PR), and this plays the
// stage in each, interleaved (flat body, 1440×900, no CPU throttle), several rounds, and compares
// the medians of main-thread CPU per frame:
//
//   gate: PR median ≤ 1.10 × base median + 0.2 ms
//
// Total renderer CPU (compositor, raster, GPU, workers) is printed beside it. It is a regression
// ratchet, not a 30 fps proof: absolute numbers are only printed. For a new system layer, serve
// the same build twice and pass --pr-path with the new layer lit (a 3D layer: with --webgl, isolated).
//
//   node scripts/cpu-ratio.mjs --base http://localhost:4391 --pr http://localhost:4392 [--rounds 6] [--ms 3000]
//        [--base-path /sim?...] [--pr-path /sim?...] [--webgl] [--isolated | --together] [--enforce] [--json out.json]
//
// --webgl: with (software) WebGL, so the 3D body draws: a new 3D layer against Digestion's (A-3 on).
// --isolated: one page at a time (R104). Each measurement opens its build's page in a fresh
//   context, lets it settle, measures it and closes it, so the other build's page is never open
//   beside it. Two open 3D pages share the software GPU, and a lit layer with a rhythm (a breath, a
//   beat) draws on the real clock even while the other page is measured: interleaved, each page's
//   number held part of the other's work. It is the default with --webgl (3D layers); --together
//   keeps both pages open as before. Without --webgl the flat stage idles when paused: both open.
//
// Report-only by default (T0): it prints the verdict and exits 0, also when it cannot measure. With
// --enforce it exits 1 when the gate fails or the run does (the CI job passes it since T10, FP-9).
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
  console.error(
    'Usage: node scripts/cpu-ratio.mjs --base <url> --pr <url> [--rounds 6] [--ms 3000] [--webgl] [--isolated | --together] [--enforce]',
  )
  process.exit(2)
}
const rounds = Number(arg('rounds', '6'))
const ms = Number(arg('ms', '3000'))
const enforce = process.argv.includes('--enforce')
const webgl = process.argv.includes('--webgl')
const isolated = process.argv.includes('--isolated') || (webgl && !process.argv.includes('--together'))

/** The browser, so a failed run can still close it. */
let browser

/** Runs the comparison; returns the exit code. */
async function run() {
  // Flat body (no WebGL): the CPU the stage itself spends, without software-rendered 3D. With
  // --webgl, SwiftShader as the e2e tests use (playwright.config.ts).
  browser = await chromium.launch({
    args: webgl ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-3d-apis'],
  })
  const builds = [
    { name: 'base', url: new URL(arg('base-path', CPU_PATH), base).href, main: [], renderer: [] },
    { name: 'pr', url: new URL(arg('pr-path', CPU_PATH), pr).href, main: [], renderer: [] },
  ]
  /** A build's stage in a fresh context, settled: shown, paused, the 3D body drawn (with --webgl). */
  const openPage = async (b) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
    const page = await context.newPage()
    await page.goto(b.url)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Play' }).waitFor()
    if (webgl) await page.locator('[data-body="3d"][data-ready]').waitFor({ timeout: 60_000 })
    return { context, page, cdp: await context.newCDPSession(page) }
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 2000))
  const measure = async (b, open, round) => {
    const r = await cpuPerFrame(open.page, open.cdp, { ms, round })
    b.main.push(r.main)
    b.renderer.push(r.renderer)
  }
  console.log(
    `${isolated ? 'Isolated: one page at a time' : 'Together: both pages open'}, ${rounds} rounds of ${ms} ms${webgl ? ', WebGL' : ''}`,
  )

  // Interleaved, and the order flips every round, so a slow patch of the machine hits both.
  if (isolated) {
    for (let round = 0; round < rounds; round++) {
      for (const b of round % 2 ? [...builds].reverse() : builds) {
        const open = await openPage(b)
        await settle()
        await measure(b, open, round)
        await open.context.close()
      }
    }
  } else {
    const pages = new Map()
    for (const b of builds) pages.set(b, await openPage(b))
    await settle()
    for (let round = 0; round < rounds; round++) {
      for (const b of round % 2 ? [...builds].reverse() : builds) await measure(b, pages.get(b), round)
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
    const result = { base: { main: b.main, renderer: b.renderer }, pr: { main: p.main, renderer: p.renderer }, ...gate, enforce, isolated }
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
