import { expect, test } from '@playwright/test'

test('home page leads to the default comparison', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('cola')
  await page.getByRole('link', { name: 'Compare two meals' }).click()
  await expect(page).toHaveURL(/\/sim\?v=1&a=cola/)
  await expect(page.getByRole('heading', { name: 'Key moments' })).toBeVisible()
  expect(errors).toEqual([])
})

test('timeline responds to the keyboard and the panel follows the meal', async ({ page }) => {
  await page.goto('/sim?v=1&a=cola:1&b=cheeseburger:1,fries:1')
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await slider.focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '120')
  await expect(page.locator('#stage-title')).toBeVisible()
})

test('adding a food updates the share link', async ({ page }) => {
  await page.goto('/sim?v=1&a=water:1&b=milk:1')
  await page.getByRole('combobox', { name: /Add food — Meal A/ }).fill('apple')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/a=water%3A1%2Capple%3A1|a=water:1,apple:1/)
})

test('step-by-step view works without 3D', async ({ page }) => {
  await page.goto('/sim?v=1&a=roti:1,dal:1&b=white-rice:1')
  await page.getByRole('button', { name: 'Step by step' }).click()
  await expect(page.getByRole('heading', { name: 'Step by step', level: 2 })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Stomach/ }).first()).toBeVisible()
})

test('Hindi switch translates the interface', async ({ page }) => {
  await page.goto('/sim')
  await page.getByRole('button', { name: 'Switch to Hindi' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByText('भोजन A').first()).toBeVisible()
})
