// Makes the pictures other sites and the install dialog show (D-EXTRA, WP-19), from the real
// stage, so they never show an old screen:
//   public/og-image.png          1200 × 630, the link preview (index.html og:image; also upload it
//                                as GitHub → Settings → Social preview)
//   public/screenshots/wide.jpg  1280 × 800, the install dialog on a laptop (manifest screenshots)
//   public/screenshots/narrow.jpg 780 × 1688 (390 × 844 at 2×), the install dialog on a phone
// Run by hand against a real (not VITE_PSEUDO) build, after a change that alters the stage's look:
//   npm run build -w @lifepeek/web
//   npm run preview -w @lifepeek/web -- --port 4175
//   node apps/web/scripts/make-share-images.mjs http://localhost:4175
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const base = process.argv[2]
if (!base) {
  console.error('Usage: node apps/web/scripts/make-share-images.mjs <preview URL, e.g. http://localhost:4175>')
  process.exit(1)
}
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
fs.mkdirSync(path.join(pub, 'screenshots'), { recursive: true })

/** The first ready lesson (cola, with burger + fries kept) a little after its first key moment. */
const LESSON = '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=40'

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const returning = {
  origins: [
    {
      origin: base,
      localStorage: [
        { name: 'lifepeek:medicalNoteSeen', value: '1' },
        { name: 'lifepeek:lang', value: 'en' },
      ],
    },
  ],
  cookies: [],
}

/** Opens the stage and waits for the 3D body and the fonts. */
async function stage(viewport, deviceScaleFactor, url) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, storageState: returning, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(base + url)
  await page.locator('[data-body="3d"]').waitFor({ timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1500)
  return { context, page }
}

// The install dialog's two pictures.
{
  const { context, page } = await stage({ width: 1280, height: 800 }, 1, LESSON)
  await page.screenshot({ path: path.join(pub, 'screenshots', 'wide.jpg'), type: 'jpeg', quality: 82 })
  await context.close()
}
{
  const { context, page } = await stage({ width: 390, height: 844 }, 2, '/sim?v=2&a=cola:1&t=40')
  await page.screenshot({ path: path.join(pub, 'screenshots', 'narrow.jpg'), type: 'jpeg', quality: 82 })
  await context.close()
}

// The link preview: the word LifePeek and the tagline beside the stage, which runs off the edge.
{
  const { context, page } = await stage({ width: 1440, height: 900 }, 1, LESSON)
  const shot = (await page.screenshot({ type: 'png' })).toString('base64')
  await page.setViewportSize({ width: 1200, height: 630 })
  // The page keeps its stylesheet (fonts and colour tokens); only the body is replaced.
  await page.evaluate((shot) => {
    document.body.innerHTML = `
      <div style="position:relative;width:1200px;height:630px;overflow:hidden;background:var(--color-paper2,#eef3f1);color:var(--color-ink,#14213d)">
        <div style="position:absolute;left:64px;top:0;bottom:0;width:380px;display:flex;flex-direction:column;justify-content:center;gap:22px">
          <div style="display:flex;align-items:center;gap:16px">
            <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M11 3v6c0 3 2 4 5 4h3c4 0 7 3 7 7s-3 8-9 8c-5 0-9-3-9-7 0-3 2-5 5-5" fill="none" stroke="#d9536a" stroke-width="4" stroke-linecap="round" />
              <circle cx="13" cy="20" r="2.2" fill="#14213d" />
            </svg>
            <span style="font-size:72px;font-weight:800;letter-spacing:-0.03em;line-height:1">LifePeek</span>
          </div>
          <p style="margin:0;font-size:34px;font-weight:700;line-height:1.15;letter-spacing:-0.01em">Peek inside living things</p>
          <p style="margin:0;font-size:24px;line-height:1.35;color:var(--color-ink-2,#46536e)">Watch a meal travel through the body, and see what it does to blood sugar and energy.</p>
        </div>
        <img src="data:image/png;base64,${shot}" alt="" style="position:absolute;left:480px;top:70px;width:960px;height:600px;border-radius:14px;border:1px solid #c3d0cc;box-shadow:0 18px 40px -12px rgb(20 33 61 / 0.35)" />
      </div>`
    document.body.style.margin = '0'
  }, shot)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(pub, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
  await context.close()
}

await browser.close()
console.log('Wrote public/og-image.png, public/screenshots/wide.jpg and narrow.jpg')
