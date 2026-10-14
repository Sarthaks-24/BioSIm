// The release gate's file checks (03 WP-22, verify-1 P7, 00 §5 D-PRIV / D-INDB / D-HIREV / D-GOV).
// Run from the repo root before tagging a release:
//
//   npm run release-gate
//
// It is NOT part of `npm run check`: until the maintainer fills in the project email, the launch
// date and the INDB sent date, the Hindi reviewer signs REVIEW.md and GOVERNANCE.md is committed,
// it fails on purpose and prints what is still missing. The human steps (live URL run, real phone,
// projector, task test, tag) are in docs/RELEASE-v2.1.md.
//
// Checks:
//   1. no placeholder text ships (`<project email>`, `<date…>`, the Hindi ones, `TO VERIFY`,
//      `<credit name…>`, and any `<…>` in privacy.* or DATA-SOURCES.md);
//   2. DATA-SOURCES.md says on which date the INDB permission email was sent;
//   3. no source in packages/engine/src/core/sources.ts is still 'toVerify', and the engine's own
//      contract test passes with RELEASE_GATE=1;
//   4. every Hindi string in REVIEW.md is `reviewed by …` (and REVIEW.md matches the JSON files),
//      only for a release with Hindi (VITE_HINDI=1, as for the build): Hindi is paused (R47), and
//      without the flag hi.json does not ship, so check 1 skips it too;
//   5. GOVERNANCE.md exists;
//   6. CHANGELOG.md's newest entry is not marked "unreleased" and has no `<…>` left in it;
//   7. the model version is sealed (MODEL_SEALED in packages/engine/src/params.ts, MODEL D12) and
//      has its seal file (packages/engine/test/sealed/v<N>.json, the D13 iii guard): model version 3
//      is sealed (R103); a later version is blocked until its own seal.
//   8. the privacy page's contact is a real email address (shown as a mailto: link, T12b);
//   9. the production build settings: no committed file turns on the test-only pseudo-locale, and
//      Hindi only together with check 4 (R47);
//  10. the browser gates are enforced: every red-list bug (e2e/helpers/gate.ts RED_LIST) and every
//      Chromium invariant project (e2e/invariants.spec.ts INVARIANTS), except the ones that stay
//      report-only on purpose (REPORT_ONLY below), and CI fails on a placeholder once the email is in.
//
// This is the production run (no VITE_HINDI, no VITE_PSEUDO, as Vercel builds). Before the
// maintainer's own items are done it fails on exactly those: the project email, the launch date,
// the INDB sent date, GOVERNANCE.md, the changelog's fps and classroom lines (docs/RELEASE-v2.1.md).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTexts, reviewRows, syncReview, REVIEW_FILE } from './hi-review.mjs'
import { PARAMS_FILE, readSeal, sealFileOf, sealProblem } from './model-seal.mjs'
import { USER_PLACEHOLDERS, VERIFY_MARKS } from './lint-placeholders.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const rel = (file) => path.relative(root, file).replace(/\\/g, '/')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

/** Text that must never ship: the named list the placeholder lint uses (one list, FIX-H / T10). */
const PLACEHOLDERS = [...USER_PLACEHOLDERS.map((p) => p.text), ...VERIFY_MARKS]

/** Shipped text: the app's source and public files, the food files, the engine, the legal files. */
const SHIPPED_DIRS = ['apps/web/src', 'apps/web/public', 'content', 'packages/engine/src', '.github/ISSUE_TEMPLATE']
const SHIPPED_FILES = [
  'apps/web/index.html',
  'README.md',
  'NOTICE',
  'LICENSE-CONTENT.md',
  'TRADEMARKS.md',
  'DATA-SOURCES.md',
  'CITATION.cff',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'GOVERNANCE.md',
]
/** Hindi ships only in a build with VITE_HINDI=1 (R47: paused); without it hi.json is not in the app. */
const HINDI = process.env.VITE_HINDI === '1'
/** REVIEW.md is the reviewer's list, not shipped; its privacy rows repeat en.json/hi.json, checked here anyway. */
const SKIP = (file) =>
  /\.test\.[cm]?[jt]sx?$/.test(file) || rel(file) === 'apps/web/src/i18n/REVIEW.md' || (!HINDI && rel(file) === 'apps/web/src/i18n/hi.json')
const TEXT = /\.(tsx?|mjs|js|json|md|txt|xml|html|css|svg|webmanifest|cff)$|^[A-Z-]+$/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (TEXT.test(entry.name) && !SKIP(full)) out.push(full)
  }
  return out
}

/** Each check: a title, and the problems found (none = passed). */
const results = []
const check = (title, problems) => results.push({ title, problems })

// 1. Placeholders.
{
  const files = [
    ...SHIPPED_DIRS.flatMap((d) => walk(path.join(root, d))),
    ...SHIPPED_FILES.map((f) => path.join(root, f)).filter(fs.existsSync),
  ]
  const problems = []
  for (const file of files) {
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        for (const p of PLACEHOLDERS) if (line.includes(p)) problems.push(`${rel(file)}:${i + 1}  "${p}…"`)
      })
  }
  // Any other angle-bracket placeholder on the privacy page (both languages) …
  const texts = readTexts()
  for (const [lang, map] of Object.entries(texts)) {
    if (lang === 'hi' && !HINDI) continue
    for (const [key, value] of map) {
      if (!key.startsWith('privacy.')) continue
      for (const [m] of value.matchAll(/<[^<>]+>/g)) {
        if (!PLACEHOLDERS.some((p) => m.includes(p))) problems.push(`${lang}.json ${key}  "${m}"`)
      }
    }
  }
  // … and in DATA-SOURCES.md (links written as <https://…> are fine).
  read('DATA-SOURCES.md')
    .split(/\r?\n/)
    .forEach((line, i) => {
      for (const [m] of line.matchAll(/<(?!https?:\/\/)[^<>]+>/g)) {
        if (!PLACEHOLDERS.some((p) => m.includes(p))) problems.push(`DATA-SOURCES.md:${i + 1}  "${m}"`)
      }
    })
  check('No placeholder text ships (project email, launch date, credit name, "TO VERIFY")', problems)
}

// 2. INDB sent date (D-INDB: launch only after the permission email has been sent).
{
  const DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/
  const lines = read('DATA-SOURCES.md')
    .split(/\r?\n/)
    .map((text, i) => ({ text, n: i + 1 }))
    .filter((l) => /permission requested\W+by email/i.test(l.text))
  const problems = lines.length ? [] : ['DATA-SOURCES.md has no "Permission requested … by email on <date>" line']
  for (const l of lines) if (!DATE.test(l.text)) problems.push(`DATA-SOURCES.md:${l.n}  no date (write it as 2026-10-20)`)
  check('DATA-SOURCES.md says when the INDB permission email was sent', problems)
}

// 3. Sources: none still 'toVerify'; the engine's contract test passes with RELEASE_GATE=1.
{
  const problems = []
  let id = null
  for (const line of read('packages/engine/src/core/sources.ts').split(/\r?\n/)) {
    const entry = /^ {2}(\w+): \{/.exec(line)
    if (entry) id = entry[1]
    if (/check: 'toVerify'/.test(line)) problems.push(`${id ?? '?'} is 'toVerify' (read it in full, then set check: 'checked')`)
  }
  const run = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'test/contract.test.ts'], {
    cwd: path.join(root, 'packages', 'engine'),
    env: { ...process.env, RELEASE_GATE: '1' },
    encoding: 'utf8',
  })
  if (run.status !== 0) {
    problems.push('packages/engine test/contract.test.ts fails with RELEASE_GATE=1:')
    const out = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`
    for (const l of out
      .split(/\r?\n/)
      .filter((x) => /sources still to verify|AssertionError|FAIL|Error/.test(x))
      .slice(0, 8))
      problems.push(`  ${l.trim()}`)
  }
  check("Every model source is read in full (no 'toVerify' in sources.ts)", problems)
}

// 4. Hindi review (D-HIREV: every v2.0 key reviewed). Only when this release has Hindi
// (VITE_HINDI=1): while Hindi is paused (R47) the app ships English only.
if (HINDI) {
  const { markdown, problems: stale } = syncReview(fs.readFileSync(REVIEW_FILE, 'utf8'))
  const problems = stale.length ? [`REVIEW.md is out of date (${stale.length}); run: node apps/web/scripts/hi-review.mjs --write`] : []
  const rows = reviewRows(markdown)
  const open = rows.filter((r) => !/^reviewed\b/i.test(r.status))
  if (open.length) {
    problems.push(`${open.length} of ${rows.length} Hindi strings are not "reviewed by …" yet, e.g.:`)
    for (const r of open.slice(0, 5)) problems.push(`  ${r.key}  (${r.status})`)
    problems.push('  full list: node apps/web/scripts/hi-review.mjs  (writes apps/web/hi-review.csv)')
  }
  check('The Hindi reviewer has signed every string in apps/web/src/i18n/REVIEW.md', problems)
}

// 5. GOVERNANCE.md (D-GOV: the user commits it).
check(
  'GOVERNANCE.md is in the repo (the maintainer commits it, D-GOV)',
  fs.existsSync(path.join(root, 'GOVERNANCE.md')) ? [] : ['GOVERNANCE.md is missing at the repo root'],
)

// 6. CHANGELOG entry for this release.
{
  const text = read('CHANGELOG.md')
  const start = text.search(/^## /m)
  const next = start < 0 ? -1 : text.slice(start + 3).search(/^## /m)
  const entry = start < 0 ? '' : next < 0 ? text.slice(start) : text.slice(start, start + 3 + next)
  const heading = entry.split(/\r?\n/)[0]
  const problems = []
  if (!entry) problems.push('CHANGELOG.md has no "## <version>" entry')
  if (/unreleased/i.test(heading)) problems.push(`newest entry is still "${heading.replace(/^## /, '')}"`)
  for (const [m] of entry.matchAll(/<(?!https?:\/\/)[^<>]+>/g))
    problems.push(`newest entry still has "${m.length > 60 ? `${m.slice(0, 57)}…` : m}"`)
  check('CHANGELOG.md has a finished entry for this release (fps and task-test line filled in)', problems)
}

// 7. The model seal (MODEL D12): no release carries a version whose numbers may still move.
{
  const seal = readSeal(fs.readFileSync(PARAMS_FILE, 'utf8'))
  const problem = sealProblem(seal, true, fs.existsSync(sealFileOf(seal.version)))
  check('The model version is sealed (MODEL_SEALED in packages/engine/src/params.ts)', problem ? [problem] : [])
}

// 8. The project email (B20; T12b: a mailto: link). RichText links any bare address; a placeholder has no "@".
{
  const en = JSON.parse(read('apps/web/src/i18n/en.json'))
  const contact = JSON.stringify(en.privacy?.sections ?? [])
  check(
    'The privacy page gives the project email (a mailto: link)',
    /[\w.+-]+@[\w-]+(\.[\w-]+)+/.test(contact) ? [] : ['apps/web/src/i18n/en.json privacy contact has no email address yet (B20)'],
  )
}

// 9. Production build settings (R47): never the pseudo-locale; Hindi only with its review check.
{
  const problems = []
  const files = ['vercel.json', 'apps/web/.env', 'apps/web/.env.production', 'apps/web/.env.example', '.env', '.env.production']
  for (const file of files.filter((f) => fs.existsSync(path.join(root, f)))) {
    const text = read(file)
    if (/VITE_PSEUDO\W+1/.test(text)) problems.push(`${file} turns on VITE_PSEUDO (the e2e build's test language)`)
    if (/VITE_HINDI\W+1/.test(text) && !HINDI)
      problems.push(`${file} turns on VITE_HINDI: run the gate with VITE_HINDI=1 so the Hindi review check runs`)
  }
  if (process.env.VITE_PSEUDO === '1') problems.push('VITE_PSEUDO=1 is set: run the gate as the production build is made, without it')
  check('Production build settings (no test language; Hindi only with its review, R47)', problems)
}

// 10. Browser gates enforced (T11). These stay report-only on purpose, each with its reason.
{
  const REPORT_ONLY = {
    B13: 'Hindi (R47: paused; its English + pseudo-locale twin is enforced)',
    B20: 'placeholders: flip to enforce once the project email and launch date are in (check 1)',
  }
  const problems = []
  const gate = read('apps/web/e2e/helpers/gate.ts')
  const red = gate.slice(gate.indexOf('export const RED_LIST'))
  for (const [, bug, mode] of red.slice(0, red.indexOf('}')).matchAll(/(B\d+): '(report|enforce)'/g)) {
    if (mode === 'report' && !REPORT_ONLY[bug]) problems.push(`${bug} is report-only in e2e/helpers/gate.ts RED_LIST`)
    if (mode === 'report' && bug === 'B20' && !/<project email>|<date/.test(read('apps/web/src/i18n/en.json')))
      problems.push('B20 is report-only, but the email and launch date are in: set it to enforce (RED_LIST)')
  }
  const inv = read('apps/web/e2e/invariants.spec.ts')
  const table = inv.slice(inv.indexOf('export const INVARIANTS'))
  for (const [, project, mode] of table.slice(0, table.indexOf('}')).matchAll(/'?([\w-]+)'?: '(report|enforce)'/g)) {
    // WebKit and Firefox run nightly (E2E_ENGINES=1) and report until a clean week (qa-fixes §3.1).
    if (mode === 'report' && !/^(webkit|firefox)-/.test(project))
      problems.push(`invariant project ${project} is report-only (e2e/invariants.spec.ts)`)
  }
  const ci = read('.github/workflows/ci.yml')
  if (!/lint:placeholders[^\n]*--enforce/.test(ci) && !/<project email>|<date/.test(read('apps/web/src/i18n/en.json')))
    problems.push(
      'CI runs the placeholder lint report-only, but the email and launch date are in: add --enforce (.github/workflows/ci.yml)',
    )
  check('The browser gates are enforced (red list, invariant projects), apart from the report-only ones with a reason', problems)
}

// Report.
const failed = results.filter((r) => r.problems.length)
console.log('\nRelease gate (file checks). Human steps: docs/RELEASE-v2.1.md, then docs/RELEASE-v3.0.md\n')
if (!HINDI) console.log('Hindi is paused (R47): the Hindi review check runs only with VITE_HINDI=1.\n')
for (const r of results) {
  console.log(`${r.problems.length ? '[ ]' : '[x]'} ${r.title}`)
  for (const p of r.problems) console.log(`      ${p}`)
}
console.log(
  failed.length ? `\nNOT READY: ${failed.length} of ${results.length} checks fail.` : `\nREADY: all ${results.length} file checks pass.`,
)
process.exit(failed.length ? 1 : 0)
