// Writes public/stats.json for the /stats page: mistakes reported and fixed per week, read from the
// repository's public GitHub issues. It runs at build time, so a visitor's browser never talks to
// GitHub; the page only downloads this file from the same site.
//
// Usage (from apps/web):  node scripts/fetch-stats.mjs
//   STATS_FETCH=1         fetch from GitHub (set in the Vercel project's environment variables).
//                         Unset (local builds, CI): write { "available": false } and stop.
//   STATS_REPO            optional "owner/name" to read instead (to try the script on another repo).
//   STATS_GITHUB_TOKEN    optional read-only token. Build machines share IP addresses, so the
//                         unauthenticated limit (60 requests an hour per address) can run out.
//
// On any error it writes { "available": false }. The build never fails because of this script.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.resolve(here, '..', 'public', 'stats.json')

export const REPO = process.env.STATS_REPO || 'Sarthaks-24/lifepeek'
/** Issues opened from the app (and the issue template) carry this label and title. */
export const LABEL = 'mistake-report'
export const TITLE_PREFIX = 'mistake:'
export const WEEKS = 12

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY

/** Monday 00:00 UTC of the week that holds `ms`. */
export function weekStart(ms) {
  const d = new Date(ms)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - sinceMonday * DAY
}

/** ISO week name, e.g. "2026-W41" (the week belongs to the year of its Thursday). */
export function isoWeek(ms) {
  const thursday = new Date(weekStart(ms) + 3 * DAY)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / WEEK) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** A mistake report: an issue (not a pull request) with the label or the "Mistake:" title. */
export function isMistake(issue) {
  if (issue.pull_request) return false
  const labelled = (issue.labels ?? []).some((l) => (typeof l === 'string' ? l : l?.name) === LABEL)
  return (
    labelled ||
    String(issue.title ?? '')
      .trim()
      .toLowerCase()
      .startsWith(TITLE_PREFIX)
  )
}

/** "Fixed" = closed as completed. Closed as not planned or duplicate counts as reported only. */
export function isFixed(issue) {
  return issue.state === 'closed' && issue.state_reason === 'completed' && Boolean(issue.closed_at)
}

function median(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Buckets issues into the last `weeks` ISO weeks (oldest first, the current week last).
 * A report counts in the week it was opened; a fix in the week it was closed. The median days to
 * fix uses the fixes inside the window, rounded to one decimal.
 */
export function bucketIssues(issues, now = Date.now(), weeks = WEEKS) {
  const first = weekStart(now) - (weeks - 1) * WEEK
  const rows = Array.from({ length: weeks }, (_, i) => {
    const start = first + i * WEEK
    return { week: isoWeek(start), start: new Date(start).toISOString().slice(0, 10), reported: 0, fixed: 0 }
  })
  const slot = (iso) => {
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms) || ms < first || ms > now) return null
    return rows[Math.floor((ms - first) / WEEK)] ?? null
  }
  const days = []
  for (const issue of issues) {
    if (!isMistake(issue)) continue
    const opened = slot(issue.created_at)
    if (opened) opened.reported++
    if (!isFixed(issue)) continue
    const closed = slot(issue.closed_at)
    if (!closed) continue
    closed.fixed++
    days.push((Date.parse(issue.closed_at) - Date.parse(issue.created_at)) / DAY)
  }
  const mid = median(days)
  return {
    weeks: rows,
    totals: { reported: rows.reduce((n, r) => n + r.reported, 0), fixed: rows.reduce((n, r) => n + r.fixed, 0) },
    medianDaysToFix: mid === null ? null : Math.round(mid * 10) / 10,
  }
}

async function github(url) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'lifepeek-stats', 'x-github-api-version': '2022-11-28' }
  if (process.env.STATS_GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.STATS_GITHUB_TOKEN}`
  return fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
}

/** All issues updated in the window: one request, a second only if the first page is full. */
async function fetchIssues(since) {
  const all = []
  for (let page = 1; page <= 2; page++) {
    const url = `https://api.github.com/repos/${REPO}/issues?state=all&per_page=100&page=${page}&since=${since}`
    const res = await github(url)
    if (!res.ok)
      throw new Error(`GitHub issues: HTTP ${res.status}${res.headers.get('x-ratelimit-remaining') === '0' ? ' (rate limit)' : ''}`)
    const list = await res.json()
    if (!Array.isArray(list)) throw new Error('GitHub issues: not a list')
    all.push(...list)
    if (list.length < 100) break
  }
  return all
}

/** The newest release, or null (none yet, or not reachable: the page then leaves it out). */
async function fetchLastRelease() {
  try {
    const res = await github(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return null
    const r = await res.json()
    const date = r.published_at ?? r.created_at
    return typeof r.tag_name === 'string' && typeof date === 'string' ? { tag: r.tag_name, date: date.slice(0, 10) } : null
  } catch {
    return null
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`)
}

async function main() {
  if (process.env.STATS_FETCH !== '1') {
    write({ available: false })
    console.log('stats: STATS_FETCH is not 1, wrote { available: false }')
    return
  }
  try {
    const now = Date.now()
    const since = new Date(weekStart(now) - (WEEKS - 1) * WEEK).toISOString()
    const issues = await fetchIssues(since)
    const lastRelease = await fetchLastRelease()
    const stats = bucketIssues(issues, now)
    write({ available: true, generatedAt: new Date(now).toISOString(), repo: REPO, ...stats, lastRelease })
    console.log(`stats: ${stats.totals.reported} reported, ${stats.totals.fixed} fixed in ${WEEKS} weeks`)
  } catch (err) {
    write({ available: false })
    console.warn(`stats: could not read GitHub (${err instanceof Error ? err.message : err}), wrote { available: false }`)
  }
}

// Run only when called as a script, not when the unit test imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((err) => console.warn(`stats: ${err instanceof Error ? err.message : err}`))
}
