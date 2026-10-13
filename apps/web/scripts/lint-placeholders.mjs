// Placeholder / TO VERIFY lint (T0; plan qa-fixes §3.2, bug B20). Shipped text must not carry a
// placeholder only the maintainer can fill ("<project email>", the launch date, a credit name), a
// "TO VERIFY" mark, or a TODO / TBD in the app's strings.
//
//   npm run lint:placeholders -w @lifepeek/web            report: prints what it finds, exits 0
//   npm run lint:placeholders -w @lifepeek/web -- --enforce   exits 1 on any finding
//
// Report-only until T10 (and T9a, once the user gives the project email: B20); then CI passes
// --enforce. scripts/release-gate.mjs forbids the same items before a release tag.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Placeholders only the user can fill (named, so the release checklist can list who owes what). */
export const USER_PLACEHOLDERS = [
  { text: '<project email>', owner: 'user: the project email (B20, §4 gate)' },
  { text: '<प्रोजेक्ट ईमेल>', owner: 'user: the project email (B20, Hindi)' },
  { text: '<date', owner: 'user: the launch date' },
  { text: '<लॉन्च की तारीख>', owner: 'user: the launch date (Hindi)' },
  { text: '<credit name', owner: 'user: a credit name' },
]
/** Marks a builder leaves for a fact still to be checked. */
export const VERIFY_MARKS = ['TO VERIFY']
/** In the app's strings only (en.json, hi.json): unfinished text. */
const STRING_MARKS = /\b(TODO|TBD|FIXME)\b/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
/** Shipped text: the app's source and public files and the food files. */
const SHIPPED_DIRS = ['apps/web/src', 'apps/web/public', 'content']
const SHIPPED_FILES = ['apps/web/index.html']
const TEXT = /\.(tsx?|mjs|js|json|md|txt|html|css|svg|webmanifest)$/
/** Tests and the reviewer's list are not shipped. */
const SKIP = (rel) => /\.test\.[cm]?[jt]sx?$/.test(rel) || rel === 'apps/web/src/i18n/REVIEW.md'

/** The findings in one file's text: `{ line, found, owner }`. */
export function findPlaceholders(text, { strings = false } = {}) {
  const found = []
  text.split(/\r?\n/).forEach((line, i) => {
    for (const p of USER_PLACEHOLDERS) if (line.includes(p.text)) found.push({ line: i + 1, found: p.text, owner: p.owner })
    for (const m of VERIFY_MARKS)
      if (line.includes(m)) found.push({ line: i + 1, found: m, owner: 'builder: check the fact, then remove the mark' })
    if (strings) {
      const m = STRING_MARKS.exec(line)
      if (m) found.push({ line: i + 1, found: m[1], owner: 'builder: unfinished string' })
    }
  })
  return found
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (TEXT.test(entry.name)) out.push(full)
  }
  return out
}

function main() {
  const enforce = process.argv.includes('--enforce')
  const files = [...SHIPPED_DIRS.flatMap((d) => walk(path.join(root, d))), ...SHIPPED_FILES.map((f) => path.join(root, f))]
  const findings = []
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (SKIP(rel) || !fs.existsSync(file)) continue
    const strings = /\/i18n\/[a-z]+\.json$/.test(rel)
    for (const f of findPlaceholders(fs.readFileSync(file, 'utf8'), { strings })) findings.push({ file: rel, ...f })
  }
  for (const f of findings) console.log(`${f.file}:${f.line}  "${f.found}"  (${f.owner})`)
  const mode = enforce ? 'enforce' : 'report'
  console.log(findings.length ? `\n${findings.length} placeholder(s) in shipped text (${mode}).` : 'No placeholders in shipped text.')
  if (enforce && findings.length) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
