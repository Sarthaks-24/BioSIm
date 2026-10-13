// Collects the red list (T0; plan qa-fixes §0) from a Playwright JSON report of the `redlist`
// project into e2e/red-list.json: for each bug, whether this run saw it and what was measured.
//
//   PLAYWRIGHT_JSON_OUTPUT_FILE=red.json npx playwright test --project=redlist --reporter=json
//   node scripts/red-list.mjs red.json [--commit eee16c9] [--write]
//
// Without --write it only prints. e2e/red-list.json as committed is the run on eee16c9 (the code
// the QA sweep tested); e2e/red-list.md explains it. CI does not run this script: the redlist
// tests are spread over the e2e shards, and each prints its own `[gate report] … red Bn` lines. Run
// it by hand on a whole redlist run.
//
// A test skipped on purpose (B7, B9, B13 and B20's Hindi half need Hindi, which a build without
// VITE_HINDI=1 lacks: R47) counts as skipped, not as an error.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const file = process.argv[2]
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/red-list.mjs <playwright-json-report> [--commit <sha>] [--write]')
  process.exit(1)
}
const report = JSON.parse(fs.readFileSync(file, 'utf8'))

/** Every test result in the report, with its title path. */
function* results(suite, titles = []) {
  for (const s of suite.suites ?? []) yield* results(s, s.title ? [...titles, s.title] : titles)
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests ?? [])
      for (const r of t.results ?? []) yield { title: [...titles, spec.title].join(' › '), test: t, result: r }
}

/** The last result of each test (a retry replaces the try before it): bug, test, what it found. */
const byTest = new Map()
for (const { title, test, result } of results({ suites: report.suites })) {
  // A result's annotations can repeat the test's: each once.
  const seen = new Set()
  const annotations = [...(test.annotations ?? []), ...(result.annotations ?? [])].filter((a) => {
    const key = `${a.type} ${a.description}`
    return !seen.has(key) && seen.add(key)
  })
  const name = title.replace(/^.*redlist\.spec\.ts › /, '')
  const found = []
  for (const a of annotations) {
    if (a.type !== 'red') continue
    const [, id, state, detail] = /^(B\d+) (reproduced|not seen):? ?(.*)$/.exec(a.description) ?? []
    if (id) found.push({ id, test: name, seen: state === 'reproduced', measured: detail ? detail.split(' | ') : [] })
  }
  const id = /\b(B\d+)\b/.exec(title)?.[1]
  if (!found.length && id && result.status === 'skipped') {
    const skip = annotations.find((a) => a.type === 'skip' || a.type === 'fixme')
    found.push({ id, test: name, seen: null, skipped: true, measured: [`skipped${skip?.description ? `: ${skip.description}` : ''}`] })
  } else if (!found.length && id && result.status !== 'passed') {
    const error = (result.error?.message ?? '').replace(/\u001b\[\d+m/g, '').split('\n')[0]
    found.push({ id, test: name, seen: null, measured: [`test ${result.status}: ${error}`] })
  }
  byTest.set(title, found)
}
/**
 * One entry per bug. A bug checked by two tests (B20: English, and Hindi when the build has it) is
 * reproduced if either saw it; a skipped test only counts when no test of that bug ran.
 */
const bugs = {}
for (const f of [...byTest.values()].flat()) {
  const b = bugs[f.id]
  if (!b || (b.skipped && !f.skipped)) bugs[f.id] = { ...f }
  else if (!f.skipped) {
    b.test = `${b.test}; ${f.test}`
    b.seen = b.seen || f.seen ? true : b.seen === null || f.seen === null ? null : false
    b.measured = [...b.measured, ...f.measured]
  }
}
const order = Object.keys(bugs).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
const out = {
  commit: arg('commit') ?? null,
  date: new Date().toISOString().slice(0, 10),
  bugs: Object.fromEntries(order.map((id) => [id, bugs[id]])),
}
for (const id of order) {
  const b = bugs[id]
  console.log(
    `${id.padEnd(4)} ${b.skipped ? 'skip ' : b.seen === null ? 'ERROR' : b.seen ? 'red  ' : 'green'}  ${b.measured.slice(0, 2).join(' | ').slice(0, 140)}`,
  )
}
const red = order.filter((id) => bugs[id].seen).length
const skipped = order.filter((id) => bugs[id].skipped).length
console.log(`\n${red} of ${order.length - skipped} red-list bugs reproduced${skipped ? ` (${skipped} skipped)` : ''}.`)
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(web, 'e2e', 'red-list.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log('Wrote e2e/red-list.json')
}
