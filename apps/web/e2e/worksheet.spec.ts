import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import QRCode from 'qrcode'
import { SHEETS, type SheetKey } from '../src/lib/worksheets.ts'
import { DEFAULT_SITE_URL } from '../scripts/site-url.mjs'
import en from '../src/i18n/en.json' with { type: 'json' }
import { checkAxe, onlyIn } from './helpers/gate.ts'

// The printable worksheets (X-3; ui-ux §8.3): each Teach lesson's sheet, printed as the browser
// prints it (A4, the print CSS), is one page, students' copy and teacher's copy alike; its QR code
// is at least 25 mm on paper and holds exactly the lesson's link on this site. Desktop project.
// Every built system's lessons are public since H-1 (R103); these links keep `?preview=1`, so that path stays tested.

// The teacher switch on in this tab, as for a teacher printing the reproduction sheet (v3.2, R117):
// Teach lists that sheet only then (reproduction.spec checks it is absent while the switch is off).
test.beforeEach(({ page }) =>
  page.addInitScript(() => {
    localStorage.setItem('lifepeek:medicalNoteSeen', '1')
    sessionStorage.setItem('lifepeek:growingUp', '1')
  }),
)

const KEYS = Object.keys(SHEETS) as SheetKey[]
/** The site address of the build under test: the planned one unless VITE_SITE_URL was set. */
const SITE = (process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, '')
const MM = 96 / 25.4

async function openSheet(page: Page, key: SheetKey) {
  await page.goto(`/teach?sheet=${key}&preview=1`)
  await expect(page.locator(`[data-worksheet="${key}"]`)).toBeVisible()
  await expect(page.locator('.ws-qr img')).toHaveJSProperty('complete', true)
}

/** The pages of a PDF (Chromium's page objects; not the /Pages tree). */
const pageCount = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0

/** The dark modules of a QR SVG made by qrcode@1.5.4 (its one stroked path of `M x y h n` runs), as a set of "x,y". */
function darkModules(svg: string) {
  const d = /stroke="#000000" d="([^"]+)"/.exec(svg)?.[1] ?? ''
  const dark = new Set<string>()
  let [x, y] = [0, 0]
  for (const [, op, a, b] of d.matchAll(/([Mmh])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
    if (op === 'M') [x, y] = [Number(a), Number(b)]
    else if (op === 'm') [x, y] = [x + Number(a), y + Number(b)]
    else {
      for (let i = 0; i < Number(a); i++) dark.add(`${x + i},${Math.floor(y)}`)
      x += Number(a)
    }
  }
  return dark
}

/** The modules QR-encoding `text` gives (level M, as scripts/qr-code.mjs), shifted by the quiet zone. */
function expectedModules(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const dark = new Set<string>()
  for (let r = 0; r < modules.size; r++) for (let c = 0; c < modules.size; c++) if (modules.get(r, c)) dark.add(`${c + 4},${r + 4}`)
  return dark
}

test('each worksheet prints on one A4 page, students’ and teacher’s copy', async ({ page }) => {
  onlyIn('desktop')
  test.setTimeout(180_000)
  const out = test.info().outputPath()
  fs.mkdirSync(out, { recursive: true })
  for (const key of KEYS) {
    await openSheet(page, key)
    for (const answers of [false, true]) {
      if (answers) await page.getByRole('checkbox', { name: en.sheet.withAnswers }).check()
      await page.emulateMedia({ media: 'print' })
      const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })
      const name = `${key}${answers ? '-answers' : ''}`
      fs.writeFileSync(`${out}/${name}.pdf`, pdf)
      await page.screenshot({ path: `${out}/${name}-print.png`, fullPage: true })
      expect(pageCount(pdf), `${name}: pages`).toBe(1)
      // On paper only the sheet: no site header, footer or buttons.
      await expect(page.getByRole('banner').first()).toBeHidden()
      await expect(page.getByRole('button', { name: en.sheet.print })).toBeHidden()
      // The QR code at least 25 mm wide on paper.
      const box = (await page.locator('.ws-qr img').boundingBox())!
      expect(box.width / MM, `${name}: QR mm`).toBeGreaterThanOrEqual(25)
      await page.emulateMedia({ media: 'screen' })
    }
  }
})

test('each worksheet’s QR code holds its lesson’s link on this site, the address printed under it', async ({ page, request }) => {
  onlyIn('desktop')
  for (const key of KEYS) {
    await openSheet(page, key)
    const link = SITE + SHEETS[key].link
    await expect(page.locator('.ws-url span')).toHaveText(link.replace(/^https?:\/\//, ''))
    const src = await page.locator('.ws-qr img').getAttribute('src')
    const svg = await (await request.get(src!)).text()
    // The picture's modules are exactly the QR encoding of the link (decoded by comparing the data).
    expect(darkModules(svg), key).toEqual(expectedModules(link))
    expect(new URL(link).searchParams.get('v')).toBeNull()
    expect(new URL(link).searchParams.get('lang')).toBeNull()
  }
})

test('Teach opens a lesson’s worksheet; answers only on the teacher’s copy; back to Teach; no a11y problems', async ({ page }) => {
  onlyIn('desktop')
  await page.goto('/teach?preview=1')
  await page.screenshot({ path: test.info().outputPath('teach.png'), fullPage: true })
  await page.getByRole('link', { name: `${en.teach.worksheet}: ${en.teach.lessons.breathRun}` }).click()
  await expect(page).toHaveURL(/\/teach\?sheet=breathRun&preview=1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.teach.lessons.breathRun)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByText('Class 6 · Class 7 · Class 10 — NCERT Class 10, Life Processes: Respiration')).toBeVisible()
  const sheet = page.locator('[data-worksheet="breathRun"]')
  const model = en.sheet.lessons.breathRun.tasks[1]!.m
  await expect(sheet.getByText(model)).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('sheet-screen.png'), fullPage: true })
  await checkAxe(page)
  // At phone width too.
  await page.setViewportSize({ width: 360, height: 640 })
  await checkAxe(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.screenshot({ path: test.info().outputPath('sheet-phone.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('checkbox', { name: en.sheet.withAnswers }).check()
  await expect(sheet.getByText(en.sheet.teacherCopy)).toBeVisible()
  await expect(sheet.getByText(model)).toBeVisible()
  // Book value first.
  const parts = sheet.locator('.ws-tasks li').nth(1).locator('.ws-part')
  await expect(parts.nth(0)).toHaveText(new RegExp(`^${en.sheet.tags.b}:`))
  await expect(parts.nth(1)).toHaveText(new RegExp(`^${en.sheet.tags.m}:`))
  await checkAxe(page)
  await page.getByRole('link', { name: en.sheet.back }).click()
  await expect(page).toHaveURL(/\/teach\?preview=1$/)
  await expect(page.getByRole('heading', { name: en.teach.title })).toBeVisible()
  // A lesson this session does not list, or no lesson: Teach as it is.
  await page.goto('/teach?sheet=nothing')
  await expect(page.getByRole('heading', { name: en.teach.title })).toBeVisible()
})
