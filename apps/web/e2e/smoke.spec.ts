import { expect, test } from '@playwright/test'

test('home page leads to the default comparison with a verdict', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('cola')
  await page.getByRole('link', { name: 'Compare two meals' }).click()
  await expect(page).toHaveURL(/\/sim\?v=2&a=cola/)
  await expect(page.getByText(/leaves the stomach about .*faster than/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Key moments' })).toBeVisible()
  expect(errors).toEqual([])
})

test('timeline responds to the keyboard and markers jump to key moments', async ({ page }) => {
  await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1')
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await slider.focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '120')
  await page.getByRole('button', { name: /^Meal B: Half has left the stomach/ }).click()
  await expect(slider).not.toHaveAttribute('aria-valuenow', '120')
  await expect(page).toHaveURL(/t=\d+/)
})

test('adding a food updates the link, and leaving and coming back keeps the meals', async ({ page }) => {
  await page.goto('/sim?v=2&a=water:1&b=milk:1')
  await page.getByRole('combobox', { name: /Add food — Meal A/ }).fill('apple')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/a=water%3A1%2Capple%3A1/)
  await page.getByRole('link', { name: 'For teachers' }).click()
  await page.getByRole('link', { name: 'Simulator' }).click()
  // The simulator writes the link when it mounts, so wait for it to be back on screen first. Coming
  // back rebuilds both 3D bodies, which in software WebGL on a loaded machine can take over 5 s.
  await expect(page.getByRole('region', { name: 'Meal A' }).getByText('Apple', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/a=water%3A1%2Capple%3A1/)
})

test('meal size cap blocks adding more and says why', async ({ page }) => {
  await page.goto('/sim?v=2&a=cheeseburger:2,fries:2&b=water:1')
  await page.getByRole('combobox', { name: /Add food — Meal A/ }).fill('rice')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('1500 kcal')
})

test('old and broken links open with a note instead of failing silently', async ({ page }) => {
  await page.goto('/sim?v=1&a=cola:1,nope:1&b=water:1')
  await expect(page.getByText(/older version of the model/)).toBeVisible()
  await expect(page.getByText(/no longer exist/)).toBeVisible()
})

test('step-by-step view works without 3D', async ({ page }) => {
  await page.goto('/sim?v=2&a=roti:1,dal:1&b=white-rice:1')
  await page.getByRole('button', { name: 'Step by step' }).click()
  await expect(page.getByRole('heading', { name: 'Step by step', level: 2 })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Stomach/ }).first()).toBeVisible()
})

test('Hindi switch translates the interface and is kept in the link', async ({ page }) => {
  await page.goto('/sim')
  await page.getByRole('button', { name: 'Switch to Hindi' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByText('भोजन A').first()).toBeVisible()
  await expect(page).toHaveURL(/lang=hi/)
})

test('footer shows Made by, Privacy and About on every page', async ({ page }) => {
  for (const path of ['/', '/sim', '/next', '/teach', '/science', '/about', '/privacy', '/stats']) {
    await page.goto(path)
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Made by Sarthak' }), path).toHaveAttribute('href', 'https://github.com/Sarthaks-24')
    await expect(footer.getByRole('link', { name: 'Privacy', exact: true }), path).toHaveAttribute('href', '/privacy')
    await expect(footer.getByRole('link', { name: 'About', exact: true }), path).toHaveAttribute('href', '/about')
    await expect(footer.getByRole('link', { name: 'Stats', exact: true }), path).toHaveAttribute('href', '/stats')
    await expect(footer.getByRole('link', { name: 'Third-party notices' }), path).toHaveAttribute('href', '/THIRD_PARTY_NOTICES.txt')
  }
})

test('privacy page renders in Hindi', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'hi'))
  await page.goto('/privacy')
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('गोपनीयता (प्राइवेसी)')
  await expect(page.getByText('देखरेख करने वाले: Sarthak (GitHub: @Sarthaks-24)')).toBeVisible()
})

test('the first-run medical note closes for good, and the blood-sugar chart keeps its note', async ({ page }) => {
  await page.goto('/sim?v=2&a=cola:1&b=water:1')
  const note = page.getByRole('region', { name: 'For learning, not for diet decisions' })
  await expect(note).toBeVisible()
  await note.getByRole('button', { name: 'Got it' }).click()
  await expect(note).toBeHidden()
  await page.reload()
  await expect(page.getByText('A typical range for a healthy adult, not a prediction for you.')).toBeVisible()
  await expect(note).toBeHidden()
})

test('the report dialog shows the public-GitHub warning', async ({ page }) => {
  await page.goto('/sim?v=2&a=water:1&b=milk:1')
  await page.getByRole('button', { name: 'Report a mistake' }).click()
  const dialog = page.getByRole('dialog', { name: 'Report a mistake' })
  await expect(dialog.getByText('This opens a public page on GitHub.')).toBeVisible()
  await expect(dialog.getByText('Reports are public.')).toBeVisible()
})

test('report with no API opens GitHub and sends nothing', async ({ page, context }) => {
  const posted: string[] = []
  context.on('request', (r) => {
    if (r.url().includes('/api/feedback')) posted.push(r.url())
  })
  // Never reach the real GitHub from a test.
  await context.route('https://github.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>GitHub stub</title>' }))
  await page.goto('/sim?v=2&a=water:1&b=milk:1')
  await page.getByRole('button', { name: 'Report a mistake' }).click()
  const dialog = page.getByRole('dialog', { name: 'Report a mistake' })
  await dialog.getByLabel('Where is the mistake?').fill('Milk')
  await dialog.getByLabel('What’s wrong, and what should it say?').fill('The fat value looks too high.')
  const popupOpened = context.waitForEvent('page')
  await dialog.getByRole('button', { name: 'Open the report on GitHub' }).click()
  const popup = await popupOpened
  await popup.waitForURL(/^https:\/\/github\.com\/Sarthaks-24\/lifepeek\/issues\/new\?/)
  const params = new URL(popup.url()).searchParams
  expect(params.get('template')).toBe('mistake.md')
  expect(params.get('title')).toBe('Mistake: Milk')
  // The pre-filled text replaces the template's, so its public warning comes first again.
  expect(params.get('body')).toMatch(/^<!--\nIssues are public\. Don't write your name/)
  expect(params.get('body')).toContain('The fat value looks too high.')
  expect(posted).toEqual([])
})

test('canonical on /teach', async ({ page }) => {
  await page.goto('/teach?from=test')
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://lifepeek.vercel.app/teach')
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://lifepeek.vercel.app/teach')
})

test('notices file is text', async ({ request }) => {
  const res = await request.get('/THIRD_PARTY_NOTICES.txt')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/plain')
  for (const file of ['/robots.txt', '/sitemap.xml']) {
    const r = await request.get(file)
    expect(r.status(), file).toBe(200)
    expect(await r.text(), file).toContain('https://lifepeek.vercel.app/')
  }
})
