import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { onlyIn, returningVisitor } from './helpers/gate.ts'

// Web basics (T12b, R72): every page's title, one H1 and alt text (axe), no sideways scroll on a
// phone, the nav and footer links at 360 px, the logo, and the not-found page. The built heads,
// sitemap and link targets are checked on dist by scripts/check-links.mjs; the 404 status and the
// rewrites by scripts/vercel-config.test.mjs (vite preview answers every path with the app).
// Desktop project only: each test sets its own window.

test.beforeEach(async ({ page }) => {
  onlyIn('desktop')
  await returningVisitor(page)
})

/** Every page, with its title (src/lib/routeMeta.ts), and a path that is no page. */
const PAGES = [
  { url: '/', title: 'LifePeek — Digestion Simulator' },
  { url: '/sim?v=3&a=cola:1', title: 'Simulator — LifePeek' },
  { url: '/teach', title: 'For teachers — LifePeek' },
  { url: '/science', title: 'Science & sources — LifePeek' },
  { url: '/about', title: 'About — LifePeek' },
  { url: '/privacy', title: 'Privacy — LifePeek' },
  { url: '/stats', title: 'Stats — LifePeek' },
  { url: '/no-such-page', title: 'Page not found — LifePeek' },
]

/** Opens a page and waits until it has drawn (its H1) and loaded what it loads on its own. */
async function open(page: Page, url: string) {
  await page.goto(url)
  await expect(page.locator('h1')).toHaveCount(1)
  if (url.startsWith('/sim')) await page.locator('[data-stage]').waitFor()
  await page.waitForLoadState('networkidle')
}

for (const { url, title } of PAGES) {
  test(`${url}: its title, one H1, alt text, and no sideways scroll at 320, 360 and 390 px`, async ({ page }) => {
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 740 })
      await open(page, url)
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(scroll, `${url} at ${width} px scrolls sideways`).toBeLessThanOrEqual(client)
    }
    await expect(page).toHaveTitle(title)
    const axe = await new AxeBuilder({ page })
      .withRules(['page-has-heading-one', 'image-alt', 'role-img-alt', 'svg-img-alt', 'input-image-alt', 'area-alt'])
      .analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
}

test('the nav at 360 px: each link opens its page and its title; the logo goes Home', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await open(page, '/')
  for (const [name, path, title] of [
    ['Simulator', '/sim', 'Simulator — LifePeek'],
    ['For teachers', '/teach', 'For teachers — LifePeek'],
    ['Science & sources', '/science', 'Science & sources — LifePeek'],
  ] as const) {
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page).toHaveTitle(title)
    await expect(page.locator('h1')).toHaveCount(1)
  }
  await page.getByRole('banner').getByRole('link', { name: 'LifePeek' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page).toHaveTitle('LifePeek — Digestion Simulator')
})

test('the footer at 360 px: every link works', async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const footer = page.getByRole('contentinfo')
  for (const [name, path, title] of [
    ['About', '/about', 'About — LifePeek'],
    ['Privacy', '/privacy', 'Privacy — LifePeek'],
    ['Stats', '/stats', 'Stats — LifePeek'],
  ] as const) {
    await open(page, '/teach')
    await footer.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page).toHaveTitle(title)
  }
  await open(page, '/teach')
  await footer.getByRole('link', { name: 'Code Apache-2.0 · Content CC BY 4.0' }).click()
  await expect(page).toHaveURL(/\/about#licences$/)
  await expect(page.locator('#licences')).toBeVisible()
  // A plain file (not an app page), and the maker's GitHub page (outside: its address only).
  const notices = footer.getByRole('link', { name: 'Third-party notices' })
  const res = await request.get((await notices.getAttribute('href'))!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/plain')
  const maker = footer.getByRole('link', { name: /^Made by / })
  await expect(maker).toHaveAttribute('href', /^https:\/\/github\.com\//)
  await expect(maker).toHaveAttribute('target', '_blank')
})

test('Home, Science and Teach link to each other', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('main').getByRole('link', { name: 'Science & sources' }).click()
  await expect(page).toHaveURL(/\/science$/)
  await page.getByRole('main').getByRole('link', { name: 'Lessons for teachers' }).click()
  await expect(page).toHaveURL(/\/teach$/)
  await page.getByRole('main').getByRole('link', { name: 'How the model works, and where its numbers come from' }).click()
  await expect(page).toHaveURL(/\/science$/)
  await page.getByRole('main').getByRole('link', { name: 'Try it in the simulator' }).click()
  await expect(page).toHaveURL(/\/sim$/)
  await open(page, '/')
  await page.getByRole('main').getByRole('link', { name: 'For teachers' }).click()
  await expect(page).toHaveURL(/\/teach$/)
})

test('the not-found page: noindex, no canonical, and links to the simulator and Home', async ({ page, request }) => {
  await open(page, '/no-such-page')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await page.getByRole('main').getByRole('link', { name: 'Go to the home page' }).click()
  await expect(page).toHaveURL(/\/$/)
  // A real page again: canonical back, noindex gone.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/)
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  // The file Vercel sends with status 404 for an unknown path (scripts/prerender-head.mjs).
  const html = await (await request.get('/404.html')).text()
  expect(html).toContain('<meta name="robots" content="noindex" />')
  expect(html).toContain('Page not found')
})

test('each page is served with its own head (built HTML, before any JavaScript)', async ({ request }) => {
  for (const { url, title } of PAGES.slice(0, 7)) {
    const path = url.split('?')[0]!
    const html = await (await request.get(path)).text()
    expect(html, path).toContain(`<title>${title.replace('&', '&amp;')}</title>`)
    expect(html, path).toMatch(new RegExp(`<link rel="canonical" href="https?://[^"]+${path === '/' ? '/' : path}"`))
    expect(html.includes('application/ld+json'), path).toBe(path === '/')
  }
})
