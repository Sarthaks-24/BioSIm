import { expect, test, type Page } from '@playwright/test'
import { onlyIn, returningVisitor } from './helpers/gate.ts'

// Visual regression (T0; plan qa-fixes §3.3). Project `visual` (E2E_VISUAL=1 only): flat body (no
// WebGL), motion reduced, the clock text masked. About 28 shots: /sim at 0 and 2 h, with and
// without a kept meal, / and /teach; English and Hindi; desktop, projector, 390 and 360 wide.
//
// Baselines are Linux only and are not made on a laptop: the "Visual baselines" workflow
// (.github/workflows/visual-baselines.yml) runs this with --update-snapshots and uploads the
// PNGs; the user commits them to e2e/visual.spec.ts-snapshots/. Until then CI does not run this
// project (a missing baseline fails). FP-10 (T1) runs it with maxDiffPixels 0 for its 0 px commits.

const VIEWS: Record<string, { width: number; height: number; projector?: boolean; phone?: boolean }> = {
  desktop: { width: 1440, height: 900 },
  projector: { width: 1280, height: 800, projector: true },
  phone390: { width: 390, height: 844, phone: true },
  phone360: { width: 360, height: 640, phone: true },
}

const PAGES: { name: string; url: string; views: string[] }[] = [
  { name: 'sim-0', url: '/sim?v=2&a=cola:1', views: Object.keys(VIEWS) },
  { name: 'sim-2h-kept', url: '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120', views: Object.keys(VIEWS) },
  { name: 'sim-2h', url: '/sim?v=2&a=cola:1&t=120', views: ['desktop', 'phone360'] },
  { name: 'sim-0-kept', url: '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=0', views: ['projector'] },
  { name: 'home', url: '/', views: ['desktop', 'phone360'] },
  { name: 'teach', url: '/teach', views: ['desktop'] },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

for (const lang of ['en', 'hi'] as const) {
  for (const p of PAGES) {
    for (const view of p.views) {
      test(`${p.name} ${view} ${lang}`, async ({ page }) => {
        onlyIn('visual')
        const v = VIEWS[view]!
        await page.setViewportSize({ width: v.width, height: v.height })
        await returningVisitor(page)
        await page.addInitScript(
          ({ lang, projector }) => {
            localStorage.setItem('lifepeek:lang', lang)
            if (projector) localStorage.setItem('lifepeek:projector', '1')
          },
          { lang, projector: !!v.projector },
        )
        await page.goto(p.url)
        await settle(page)
        await expect(page).toHaveScreenshot(`${p.name}-${view}-${lang}.png`, {
          // The dock's clock text (the time a shot is taken at is set by the link; it is masked anyway).
          mask: [page.locator('[data-stage] .text-clock-sm')],
          animations: 'disabled',
          maxDiffPixelRatio: 0.002,
        })
      })
    }
  }
}

// One 3D shot (project visual-3d, software WebGL), with a loose threshold: SwiftShader differs a little between runs.
test('sim 3D desktop en', async ({ page }) => {
  onlyIn('visual-3d')
  await returningVisitor(page)
  await page.goto('/sim?v=2&a=cola:1')
  await expect(page.locator('[data-body="3d"]')).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('sim-3d-desktop-en.png', {
    mask: [page.locator('[data-stage] .text-clock-sm')],
    maxDiffPixelRatio: 0.05,
  })
})
