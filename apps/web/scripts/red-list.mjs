// Collects the red list (T0; plan qa-fixes §0) from a Playwright JSON report of the `redlist`
// project into e2e/red-list.json: for each bug, whether this run saw it and what was measured.
//
//   PLAYWRIGHT_JSON_OUTPUT_FILE=red.json npx playwright test --project=redlist --reporter=json
//   node scripts/red-list.mjs red.json [--commit eee16c9] [--write]
//
// Without --write it only prints. e2e/red-list.json as committed is the run on eee16c9 (the code
// the QA sweep tested); e2e/red-list.md explains it. CI prints this summary after the redlist run.
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

const bugs = {}
for (const { title, test, result } of results({ suites: report.suites })) {
  const annotations = [...(test.annotations ?? []), ...(result.annotations ?? [])]
  for (const a of annotations) {
    if (a.type !== 'red') continue
    const [, id, state, detail] = /^(B\d+) (reproduced|not seen):? ?(.*)$/.exec(a.description) ?? []
    if (!id) continue
    bugs[id] = {
      test: title.replace(/^.*redlist\.spec\.ts › /, ''),
      seen: state === 'reproduced',
      measured: detail ? detail.split(' | ') : [],
    }
  }
  if (result.status !== 'passed' && !annotations.some((a) => a.type === 'red')) {
    const id = /\b(B\d+)\b/.exec(title)?.[1]
    if (id)
      bugs[id] = {
        test: title,
        seen: null,
        measured: [`test ${result.status}: ${(result.error?.message ?? '').replace(/\u001b\[\d+m/g, '').split('\n')[0]}`],
      }
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
    `${id.padEnd(4)} ${b.seen === null ? 'ERROR' : b.seen ? 'red  ' : 'green'}  ${b.measured.slice(0, 2).join(' | ').slice(0, 140)}`,
  )
}
const red = order.filter((id) => bugs[id].seen).length
console.log(`\n${red} of ${order.length} red-list bugs reproduced.`)
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(web, 'e2e', 'red-list.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log('Wrote e2e/red-list.json')
}
