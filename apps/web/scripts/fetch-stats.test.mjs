import { describe, expect, it } from 'vitest'
import { bucketIssues, isoWeek, weekStart } from './fetch-stats.mjs'

// Wednesday of ISO week 2026-W42. The 12-week window starts on Monday 2026-07-27.
const NOW = Date.parse('2026-10-14T12:00:00Z')
const label = [{ name: 'mistake-report' }]

/** Ten fake issues, shaped like the GitHub REST API's (only the fields the script reads). */
const ISSUES = [
  // 1. Opened this week, still open.
  { title: 'Mistake: cola sugar', labels: label, state: 'open', state_reason: null, created_at: '2026-10-12T09:00:00Z', closed_at: null },
  // 2. Label only (title edited), fixed in 2 days, same week.
  {
    title: 'Cola sugar too high',
    labels: label,
    state: 'closed',
    state_reason: 'completed',
    created_at: '2026-10-05T10:00:00Z',
    closed_at: '2026-10-07T10:00:00Z',
  },
  // 3. Title only (no label), fixed in 4 days, same week (Mon 28 Sep → Fri 2 Oct).
  {
    title: 'Mistake: roti',
    labels: [],
    state: 'closed',
    state_reason: 'completed',
    created_at: '2026-09-28T00:00:00Z',
    closed_at: '2026-10-02T00:00:00Z',
  },
  // 4. Closed as not planned: reported, not fixed.
  {
    title: 'Mistake: dal',
    labels: label,
    state: 'closed',
    state_reason: 'not_planned',
    created_at: '2026-09-01T08:00:00Z',
    closed_at: '2026-09-03T08:00:00Z',
  },
  // 5. A pull request: ignored even with the title.
  {
    title: 'Mistake: fix roti',
    labels: label,
    state: 'closed',
    state_reason: null,
    created_at: '2026-09-02T08:00:00Z',
    closed_at: '2026-09-02T09:00:00Z',
    pull_request: { url: 'x' },
  },
  // 6. Not a mistake report: ignored.
  {
    title: 'Add more foods',
    labels: [{ name: 'idea' }],
    state: 'open',
    state_reason: null,
    created_at: '2026-09-10T08:00:00Z',
    closed_at: null,
  },
  // 7. Opened before the window, fixed inside it (63 days): a fix, not a report.
  {
    title: 'Mistake: old',
    labels: label,
    state: 'closed',
    state_reason: 'completed',
    created_at: '2026-06-01T00:00:00Z',
    closed_at: '2026-08-03T00:00:00Z',
  },
  // 8. Lower-case title prefix, fixed in 1.5 days.
  {
    title: 'mistake: lower case',
    labels: [],
    state: 'closed',
    state_reason: 'completed',
    created_at: '2026-08-10T00:00:00Z',
    closed_at: '2026-08-11T12:00:00Z',
  },
  // 9. Opened at the very start of the window.
  { title: 'Wrong fat value', labels: label, state: 'open', state_reason: null, created_at: '2026-07-27T00:00:00Z', closed_at: null },
  // 10. One minute before the window: ignored.
  { title: 'Mistake: too early', labels: label, state: 'open', state_reason: null, created_at: '2026-07-26T23:59:00Z', closed_at: null },
]

describe('stats bucketing', () => {
  const stats = bucketIssues(ISSUES, NOW)

  it('makes 12 Monday-to-Sunday weeks, oldest first, ending with this week', () => {
    expect(stats.weeks).toHaveLength(12)
    expect(stats.weeks[0]).toMatchObject({ week: '2026-W31', start: '2026-07-27' })
    expect(stats.weeks[11]).toMatchObject({ week: '2026-W42', start: '2026-10-12' })
  })

  it('counts reports in the week they were opened and fixes in the week they were closed', () => {
    expect(stats.weeks.map((w) => w.reported)).toEqual([1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1])
    expect(stats.weeks.map((w) => w.fixed)).toEqual([0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0])
    expect(stats.totals).toEqual({ reported: 6, fixed: 4 })
  })

  it('takes the median days to fix over the fixes in the window', () => {
    // 1.5, 2, 4 and 63 days → (2 + 4) / 2
    expect(stats.medianDaysToFix).toBe(3)
  })

  it('has no median when nothing was fixed', () => {
    expect(bucketIssues([ISSUES[0]], NOW)).toMatchObject({ totals: { reported: 1, fixed: 0 }, medianDaysToFix: null })
  })

  it('names ISO weeks across the new year', () => {
    expect(isoWeek(Date.parse('2027-01-01T12:00:00Z'))).toBe('2026-W53')
    expect(isoWeek(Date.parse('2027-01-04T00:00:00Z'))).toBe('2027-W01')
    expect(new Date(weekStart(Date.parse('2026-10-18T23:59:59Z'))).toISOString()).toBe('2026-10-12T00:00:00.000Z')
  })
})
