// The Hindi reviewer's list (03 WP-18, roadmap A12; 00 gate 3.1). Every Hindi string has a row in
// apps/web/src/i18n/REVIEW.md with its status: `draft`, or `reviewed by <initials> <date>` once a
// native reviewer has checked it. This script keeps that list honest and exports it:
//
//   node apps/web/scripts/hi-review.mjs            writes apps/web/hi-review.csv (key, English, Hindi,
//                                                  status) and lists every key that is not reviewed
//   node apps/web/scripts/hi-review.mjs --write    first brings REVIEW.md up to date with the JSON:
//                                                  new keys get a `draft` row, the English and Hindi
//                                                  columns follow the files, a reviewed row whose
//                                                  Hindi changed goes back to `draft`, rows of
//                                                  deleted keys go
//   node apps/web/scripts/hi-review.mjs --check    exits 1 if REVIEW.md is out of date (i18n.test.ts
//                                                  runs the same check)
//
// So nobody keeps the list by hand any more: add the string to en.json and hi.json, run --write,
// and only a reviewer ever changes a status. The CSV opens in any spreadsheet (UTF-8 with BOM).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const I18N = path.join(web, 'src', 'i18n')
export const REVIEW_FILE = path.join(I18N, 'REVIEW.md')
const CSV_FILE = path.join(web, 'hi-review.csv')

/** Where keys new to REVIEW.md go, until someone moves them under a better heading. */
const NEW_SECTION = '## New strings (added by scripts/hi-review.mjs)'
const TABLE_HEAD = ['| Key | English | Hindi | Status |', '|---|---|---|---|']
/** A table row: | `key` | English | Hindi | status | */
const ROW = /^\| `([^`]+)` \| (.*) \| (.*) \| ([^|]*) \|$/

/** "a.b[0].c" → text, in file order. Keys are written the way REVIEW.md always has. */
export function flatten(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  else out.set(prefix, String(value))
  return out
}

/** A text as one table cell: on one line, with its pipes escaped. */
const cell = (s) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')

const isReviewed = (status) => /^reviewed\b/i.test(status)

export function readTexts() {
  const read = (name) => flatten(JSON.parse(fs.readFileSync(path.join(I18N, name), 'utf8')))
  return { en: read('en.json'), hi: read('hi.json') }
}

/**
 * REVIEW.md as it should be: every Hindi key once, its texts as in the JSON files, statuses kept
 * (a reviewed row whose Hindi changed is `draft` again). `problems` says what was out of date.
 */
export function syncReview(markdown, { en, hi } = readTexts()) {
  const problems = []
  const seen = new Set()
  const lines = []
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const m = ROW.exec(line)
    if (!m) {
      lines.push(line)
      continue
    }
    const [, key, enCell, hiCell, rawStatus] = m
    let status = rawStatus.trim()
    if (!hi.has(key)) {
      problems.push(`${key}: no longer in hi.json (row removed)`)
      continue
    }
    if (seen.has(key)) {
      problems.push(`${key}: listed twice (second row removed)`)
      continue
    }
    seen.add(key)
    const wantEn = cell(en.get(key) ?? '')
    const wantHi = cell(hi.get(key))
    if (enCell !== wantEn) problems.push(`${key}: English differs from en.json`)
    if (hiCell !== wantHi) {
      problems.push(`${key}: Hindi differs from hi.json`)
      if (isReviewed(status)) status = 'draft'
    }
    if (status !== 'draft' && !isReviewed(status)) {
      problems.push(`${key}: status "${status}" is neither draft nor "reviewed by …"`)
      status = 'draft'
    }
    lines.push(`| \`${key}\` | ${wantEn} | ${wantHi} | ${status} |`)
  }
  const missing = [...hi.keys()].filter((k) => !seen.has(k))
  if (missing.length) {
    for (const k of missing) problems.push(`${k}: not listed (added as draft)`)
    const rows = missing.map((k) => `| \`${k}\` | ${cell(en.get(k) ?? '')} | ${cell(hi.get(k))} | draft |`)
    let at = lines.indexOf(NEW_SECTION)
    if (at < 0) {
      // A section of its own, just before the sign-off.
      const signOff = lines.indexOf('## Sign-off')
      const before = signOff < 0 ? lines.length : signOff
      lines.splice(before, 0, NEW_SECTION, '', ...TABLE_HEAD, ...rows, '')
    } else {
      // At the end of that section's table.
      let end = at + 1
      while (end < lines.length && !lines[end].startsWith('## ')) end++
      while (end > at && lines[end - 1] === '') end--
      lines.splice(end, 0, ...rows)
    }
  }
  return { markdown: lines.join('\n'), problems }
}

/** Every row of the (synced) list: key, English, Hindi, status. */
export function reviewRows(markdown) {
  const rows = []
  for (const line of markdown.split('\n')) {
    const m = ROW.exec(line)
    if (m) rows.push({ key: m[1], en: m[2], hi: m[3], status: m[4].trim() })
  }
  return rows
}

const csvField = (s) => `"${s.replace(/\\\|/g, '|').replace(/"/g, '""')}"`

function main(args) {
  const before = fs.readFileSync(REVIEW_FILE, 'utf8')
  const { markdown, problems } = syncReview(before)
  if (args.includes('--check')) {
    if (problems.length) {
      console.error(`REVIEW.md is out of date (${problems.length}). Run: node apps/web/scripts/hi-review.mjs --write`)
      for (const p of problems) console.error(`  ${p}`)
      process.exit(1)
    }
    console.log('REVIEW.md lists every Hindi string, with the texts in en.json and hi.json.')
    return
  }
  if (args.includes('--write')) {
    if (markdown !== before.replace(/\r\n/g, '\n')) fs.writeFileSync(REVIEW_FILE, markdown)
    for (const p of problems) console.log(`fixed: ${p}`)
  } else if (problems.length) {
    console.warn(`REVIEW.md is out of date (${problems.length}); the CSV uses the JSON files. Run with --write to update it.`)
  }
  const rows = reviewRows(markdown)
  const csv = ['key,English,Hindi,status', ...rows.map((r) => [r.key, r.en, r.hi, r.status].map(csvField).join(','))].join('\r\n')
  fs.writeFileSync(CSV_FILE, `﻿${csv}\r\n`)
  const open = rows.filter((r) => !isReviewed(r.status))
  console.log(`${rows.length} Hindi strings, ${rows.length - open.length} reviewed, ${open.length} to review. Wrote ${path.relative(process.cwd(), CSV_FILE)}.`)
  for (const r of open) console.log(`  ${r.key}  (${r.status})`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
