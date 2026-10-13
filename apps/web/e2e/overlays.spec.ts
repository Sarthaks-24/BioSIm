import { expect, test, type Locator, type Page } from '@playwright/test'
import { bodySettled, checkBody, gateSteps, onlyIn, overlayProblems, returningVisitor, verdict, type Mode } from './helpers/gate.ts'

// FP-5 (T4): the stage's overlays (qa-fixes §1; bugs B5, B10, U4, U9). Every overlay on every
// project: wholly in the window, below the header, with a button named "Close"; Esc and Back close
// it, and Back keeps the meal. Every menu action closes its menu. "More" covers at most 10 % of
// the body; so does the no-WebGL note (it is a line in the notes now). Enforced on every Chromium
// project; webkit-* and firefox-* report for a week first, as the other Track A checks did.

const REPORT_FIRST = ['webkit-desktop', 'webkit-phone', 'firefox-desktop']
const mode = (): Mode => (REPORT_FIRST.includes(test.info().project.name) ? 'report' : 'enforce')

const KEPT = '/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1&t=20'
const SIX = '/sim?v=3&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1&t=20'

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })
test.beforeEach(async ({ page }) => {
  await returningVisitor(page)
  // The invariants' projector project has projector mode on, as a teacher would.
  if (test.info().project.name === 'projector-sizes') await page.addInitScript(() => localStorage.setItem('lifepeek:projector', '1'))
})

async function open(page: Page, url: string) {
  await page.goto(url)
  await page.locator('[data-stage]').waitFor()
  await page.waitForLoadState('networkidle')
  await bodySettled(page, 10_000)
}

interface Opener {
  name: string
  url: string
  /** The visible button that opens it (none: this project has no such overlay). */
  button: (page: Page) => Locator
  overlay: (page: Page) => Locator
}

const visible = (l: Locator) => l.filter({ visible: true }).first()
const OVERLAYS: Opener[] = [
  {
    name: 'How we know',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: /^How we know/ })),
    overlay: (p) => p.getByRole('dialog', { name: /^How we know/ }),
  },
  {
    name: '⋯',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: 'More actions' })),
    overlay: (p) => p.getByRole('dialog', { name: 'More actions' }),
  },
  {
    name: 'servings',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: /^Cola/ })),
    overlay: (p) => p.getByRole('dialog', { name: /^Servings: / }),
  },
  {
    name: '"+n" list',
    url: SIX,
    button: (p) => visible(p.getByRole('button', { name: /^\+\d+ / })),
    overlay: (p) => p.getByRole('dialog', { name: 'Meal' }),
  },
  {
    name: 'stage "More"',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: /: more about this stage$/ })),
    // A column beside the body from 1024 px up, a sheet below.
    overlay: (p) => p.locator('section[data-stage-more], [role=dialog]:has([data-stage-more])'),
  },
  {
    name: 'Settings',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: 'Settings', exact: true })),
    overlay: (p) => p.getByRole('dialog', { name: 'Settings', exact: true }),
  },
  {
    name: 'Add food',
    url: KEPT,
    button: (p) => visible(p.getByRole('button', { name: 'Add food' })),
    overlay: (p) => p.getByRole('dialog', { name: 'Add food' }),
  },
]

for (const o of OVERLAYS) {
  test(`${o.name}: in the window, below the header, a Close button; Esc and Back close it (B5, U4)`, async ({ page }) => {
    await gateSteps(`overlay ${o.name}`, mode(), async () => {
      await open(page, o.url)
      const button = o.button(page)
      test.skip(!(await button.count()), `no ${o.name} here`)
      const overlay = o.overlay(page).first()
      await button.scrollIntoViewIfNeeded()
      await button.click()
      await expect(overlay).toBeVisible()
      // Placed (a sheet slides nowhere; a popover is placed before it shows), then measured.
      await page.waitForTimeout(300)
      expect(await overlayProblems(page, overlay), 'where it is').toEqual([])
      await page.keyboard.press('Escape')
      await expect(overlay, 'Esc closes it').toBeHidden()

      const meal = new URL(page.url()).searchParams.get('a')
      await button.click()
      await expect(overlay).toBeVisible()
      await page.goBack()
      await expect(overlay, 'Back closes it').toBeHidden()
      await page.waitForTimeout(300)
      expect(new URL(page.url()).pathname, 'Back stays on the stage').toBe('/sim')
      expect(new URL(page.url()).searchParams.get('a'), 'Back keeps the meal').toBe(meal)
    })
  })
}

test('"⋯": each action closes the menu and gives the focus back (B10, FP-5)', async ({ page }) => {
  await gateSteps('menu actions close it', mode(), async () => {
    await open(page, '/sim?v=3&a=cola:1')
    const more = page.getByRole('button', { name: 'More actions' })
    const menu = page.getByRole('dialog', { name: 'More actions' })
    await more.click()
    await expect(menu).toBeVisible()
    // Keep is in "⋯" below 1024 px; from 1024 px up it is on the bar, and "Science & sources" is the action left.
    const keep = menu.getByRole('button', { name: 'Keep to compare' })
    if (await keep.isVisible()) {
      await keep.click()
      await expect(menu).toBeHidden()
      await expect(more).toBeFocused()
      await expect(more).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('[data-kept-tag], [data-now-kept]').first()).toBeAttached()
    } else {
      await menu.getByRole('link', { name: 'Science & sources' }).click()
      await expect(page).toHaveURL(/\/science/)
      await expect(menu).toBeHidden()
    }
  })
})

test('the phone menu closes after Projector mode, over a dimmed page that a tap closes (B10)', async ({ page }) => {
  await gateSteps('phone menu', mode(), async () => {
    await open(page, '/sim?v=3&a=cola:1')
    const menuButton = page.getByRole('button', { name: 'Menu' })
    test.skip(!(await menuButton.isVisible()), 'the links are a row here')
    await menuButton.click()
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    // A tap on the dimmed page closes the menu and presses nothing under it.
    const before = page.url()
    await page.mouse.click(180, page.viewportSize()!.height - 20)
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(page.url()).toBe(before)
    await menuButton.click()
    const projector = page.getByRole('button', { name: 'Projector mode' }).filter({ visible: true })
    // A phone on its side has no projector size: the stage offers no switch there while it is off.
    test.skip(!(await projector.count()), 'no projector switch in this menu')
    const on = (await projector.getAttribute('aria-pressed')) === 'true'
    await projector.click()
    if (on) await expect(page.locator('html')).not.toHaveAttribute('data-contrast', 'high')
    else await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await expect(menuButton).toBeFocused()
  })
})

test('stage "More" covers at most 10 % of the body (U4)', async ({ page }) => {
  await open(page, KEPT)
  await page
    .getByRole('button', { name: /: more about this stage$/ })
    .filter({ visible: true })
    .first()
    .click()
  await expect(page.locator('[data-stage-more]')).toBeVisible()
  await page.waitForTimeout(500)
  await bodySettled(page, 10_000)
  await checkBody(page, { maxCovered: 0.1 }, { mode: mode(), label: '"More" open' })
})

test('without WebGL the note is a line in the notes, not over the body, and it can be dismissed (U9)', async ({ page }) => {
  onlyIn('nowebgl')
  await open(page, KEPT)
  const note = page.getByText('can’t show 3D here')
  await expect(note).toBeVisible()
  const body = page.locator('[data-body]').first()
  const [n, b] = [(await note.boundingBox())!, (await body.boundingBox())!]
  verdict(
    'no-WebGL note above the body',
    'enforce',
    n.y + n.height <= b.y + 1 ? [] : [`note ends at ${n.y + n.height}, body starts at ${b.y}`],
  )
  await checkBody(page, { maxCovered: 0.1 }, { mode: 'enforce', label: 'no WebGL' })
  await note.locator('xpath=ancestor::li[1]').getByRole('button', { name: 'Close' }).click()
  await expect(note).toBeHidden()
})
