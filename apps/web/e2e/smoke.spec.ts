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
  // The simulator writes the link when it mounts, so wait for it to be back on screen first.
  await expect(page.getByRole('region', { name: 'Meal A' }).getByText('Apple', { exact: true })).toBeVisible()
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
