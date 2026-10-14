import { expect, test } from '@playwright/test'
import { goto } from './helpers/gate.ts'

// Lymph & germ defence (A-11a): a Drawing-only row, hidden until the v3.0 release gate, so only a
// `?preview=1` link opens it. Its pack loads when it is lit: the static lymph map over the full
// body, the Now line with the "Drawing only" tag, and the germ-defence card in the graphs' place.
// Projects desktop and phone. E2E_SHOTS=1 saves a picture of each to .shots/ (git-ignored).

const LYMPH = '/sim?v=3&a=cola:1&layer=lymph&preview=1'

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1')))

test('a preview link lights the lymph map, its Now line and the germ-defence card', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await goto(page, LYMPH)

  // The map: the full body, the lymph layer drawn over it, its labels (the first three on a phone).
  await expect(page.locator('[data-body="flat"][data-framing="full"]')).toBeVisible()
  await expect(page.locator('canvas[data-layer="lymph"][data-drawn]')).toBeVisible()
  for (const label of ['Lymph nodes', 'Main lymph duct', 'Spleen'])
    await expect(page.locator('[data-callout]').filter({ hasText: label })).toBeVisible()

  // The Now line says what lymph does, tagged "Drawing only" (one of the three tags, R13).
  const now = page.locator('[data-now="lymph"]').filter({ visible: true })
  await expect(now).toContainText('Drawing only')
  await expect(now).toContainText('Lymph vessels take the fluid')

  // The card: its tag, the white-cell range with "labs differ", and its source line (R13, R31).
  const card = page.locator('[data-card="germs"]')
  await expect(card.getByRole('heading', { name: 'Germ defence' })).toBeVisible()
  await expect(card.locator('[data-status="illustration"]')).toHaveText('Drawing only')
  await expect(card).toContainText('About 5,000–10,000 white cells per µL of blood')
  await expect(card).toContainText('labs differ')
  await expect(card).toContainText('Source: OpenStax Anatomy and Physiology 2e, sections 18.4')
  await expect(card).toContainText('Stomach acid kills many germs, not all')
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/a11a-lymph-${info.project.name}.png` })

  // Next steps the four panels; Back and Next keep the focus at either end.
  const next = card.getByRole('button', { name: /Next/ })
  const back = card.getByRole('button', { name: /Back/ })
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  for (const [step, title] of [
    [2, 'A cut lets germs in'],
    [3, 'White cells fight'],
    [4, 'Antibodies and memory'],
  ] as const) {
    await next.click()
    await expect(card.getByRole('heading', { level: 4 })).toHaveText(`${step} · ${title}`)
    await expect(card).toContainText(`${step} of 4`)
  }
  await expect(card.getByRole('img')).toHaveAccessibleName(/antibodies/i)
  await expect(next).toHaveAttribute('aria-disabled', 'true')
  // Pressed at the end, it stays put and keeps the focus (Playwright will not click an aria-disabled button).
  await next.press('Enter')
  await expect(card).toContainText('4 of 4')
  await expect(next).toBeFocused()
  if (process.env.E2E_SHOTS) await card.screenshot({ path: `../../.shots/a11a-germ-card-4-${info.project.name}.png` })
  await back.click()
  await expect(card).toContainText('3 of 4')

  // No graph tabs or empty graph frames for a row with no graphs: the card is the column.
  await expect(page.locator('section[aria-labelledby="graphs-title"] > :not([data-card]) svg')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('without ?preview=1 the hidden lymph row opens Digestion', async ({ page }) => {
  await goto(page, '/sim?v=3&a=cola:1&layer=lymph')
  await expect(page.locator('[data-now]').filter({ visible: true }).first()).toHaveAttribute('data-now', /^(?!lymph)/)
  await expect(page.locator('[data-card="germs"]')).toHaveCount(0)
  await expect(page.locator('canvas[data-layer="lymph"]')).toHaveCount(0)
})
