import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { checkAxe } from './helpers/gate.ts'

// /stats shows public numbers from /stats.json, a file on the same site written at build time
// (scripts/fetch-stats.mjs). Test builds don't set STATS_FETCH, so the served file says
// { available: false }. The tests that need real numbers serve a fixture instead. No test reaches
// GitHub: any request to it is blocked and fails the test.

const WEEK = 7 * 24 * 60 * 60 * 1000
const FIRST = Date.parse('2026-07-27T00:00:00Z')
const REPORTED = [0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1]
const FIXED = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]
const FIXTURE = {
  available: true,
  generatedAt: '2026-10-12T03:05:00Z',
  repo: 'Sarthaks-24/lifepeek',
  weeks: REPORTED.map((reported, i) => ({
    week: `2026-W${31 + i}`,
    start: new Date(FIRST + i * WEEK).toISOString().slice(0, 10),
    reported,
    fixed: FIXED[i],
  })),
  totals: { reported: 5, fixed: 3 },
  medianDaysToFix: 4.5,
  lastRelease: { tag: 'v1.0.0', date: '2026-10-01' },
}

/** Records every request the page makes, and stops any that would leave the site. */
async function watchRequests(context: BrowserContext, page: Page) {
  const urls: string[] = []
  context.on('request', (r) => urls.push(r.url()))
  await context.route(/^https:\/\/([\w-]+\.)?github(usercontent)?\.com\//, (route) => route.abort())
  return () => {
    const own = new URL(page.url()).origin
    return urls.filter((u) => !u.startsWith(`${own}/`) && !u.startsWith('data:') && !u.startsWith('blob:'))
  }
}

const serve = (page: Page, body: unknown) =>
  page.route('**/stats.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }))

test('/stats renders with { available: false } from the CI build, and only talks to its own site', async ({ page, context }) => {
  const elsewhere = await watchRequests(context, page)
  const statsFile = page.waitForResponse((r) => new URL(r.url()).pathname === '/stats.json')
  await page.goto('/stats')
  expect(await (await statsFile).json()).toEqual({ available: false })

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LifePeek in numbers')
  await expect(page.getByText("We don't count visitors.")).toBeVisible()
  await expect(page.getByText('Numbers will appear after the next weekly update.')).toBeVisible()
  // Facts about this version don't need the file.
  const facts = page.getByRole('region', { name: 'This version' })
  await expect(facts.getByText('Foods')).toBeVisible()
  await expect(facts.getByText('English and Hindi')).toBeVisible()
  await expect(facts.getByText('Last release')).toHaveCount(0)

  await page.waitForLoadState('networkidle')
  expect(elsewhere()).toEqual([])
})

test.describe('with numbers', () => {
  // page.route can't see requests a service worker answers; keep the worker out of these tests.
  test.use({ serviceWorkers: 'block' })

  test('/stats shows weekly mistake counts from stats.json', async ({ page, context }) => {
    const elsewhere = await watchRequests(context, page)
    await serve(page, FIXTURE)
    await page.goto('/stats')
    const mistakes = page.getByRole('region', { name: 'Mistakes reported and fixed' })
    await expect(mistakes.getByRole('definition').filter({ hasText: /^5$/ })).toBeVisible()
    await expect(mistakes.getByRole('definition').filter({ hasText: /^3$/ })).toBeVisible()
    await expect(mistakes.getByRole('definition').filter({ hasText: /^4\.5$/ })).toBeVisible()

    const table = mistakes.getByRole('table', { name: 'Week by week' })
    await expect(table.getByRole('row')).toHaveCount(13)
    await expect(table.getByRole('row', { name: /3 Aug/ })).toContainText('0')
    await expect(table.getByRole('row', { name: /this week/ })).toContainText('12 Oct')
    await expect(mistakes.getByText('Updated 12 Oct 2026.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'This version' }).getByText('v1.0.0')).toBeVisible()
    expect(elsewhere()).toEqual([])
  })

  test('/stats says so when the numbers cannot load, and can try again', async ({ page }) => {
    await page.route('**/stats.json', (route) => route.abort('internetdisconnected'))
    await page.goto('/stats')
    await expect(page.getByText("The numbers didn't load. You may be offline.")).toBeVisible()
    await page.unroute('**/stats.json')
    await serve(page, FIXTURE)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('table', { name: 'Week by week' })).toBeVisible()
  })

  test('a broken or missing stats.json reads as "not yet"', async ({ page }) => {
    await page.route('**/stats.json', (route) => route.fulfill({ status: 404, body: 'Not found' }))
    await page.goto('/stats')
    await expect(page.getByText('Numbers will appear after the next weekly update.')).toBeVisible()
    await page.unroute('**/stats.json')
    await serve(page, { available: true, weeks: 'nope' })
    await page.reload()
    await expect(page.getByText('Numbers will appear after the next weekly update.')).toBeVisible()
  })

  test('/stats has no serious accessibility issues, with numbers and in Hindi', async ({ page }) => {
    await serve(page, FIXTURE)
    await page.goto('/stats')
    await expect(page.getByRole('table')).toBeVisible()
    await checkAxe(page)
    await page.getByRole('button', { name: 'Switch to Hindi' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('LifePeek आँकड़ों में')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'आँकड़े' })).toHaveAttribute('href', '/stats')
    await checkAxe(page)
  })
})
