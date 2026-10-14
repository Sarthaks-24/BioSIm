import { expect, test, type Page } from '@playwright/test'
import {
  GATE_ROUTES,
  SIM_BODY,
  bodySettled,
  expectInFirstScreen,
  expectNoPageScroll,
  gateSteps,
  modeFor,
  onlyIn,
  openMealActions,
  showChip,
} from './helpers/gate.ts'

// The stage draws a body and plays. Projects desktop, projector, phone and reduced have (software)
// WebGL; project nowebgl has none, so the page must fall back to the flat body and say why.

for (const route of GATE_ROUTES.stage) {
  test(`the stage draws a body and plays: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    const flat = test.info().project.name === 'nowebgl'
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(route.url)

    await gateSteps(flat ? 'flat fallback' : '3D stage', mode, async () => {
      const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
      expect(webgl, 'WebGL in this project').toBe(!flat)
      const note = page.getByText('can’t show 3D here')
      await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
      if (flat) await expect(note.first()).toBeVisible()
      else await expect(note).toHaveCount(0)

      const timeline = page.getByRole('slider').first()
      await page.getByRole('button', { name: 'Play' }).click()
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
      await expect(timeline).not.toHaveAttribute('aria-valuenow', '0')
      await page.getByRole('button', { name: 'Pause' }).click()
      expect(errors, 'page errors').toEqual([])
    })
  })
}

// The body picture (WP-16). Organ labels never overlap and never leave the picture, in English
// and in Hindi (wider), at phone, laptop and projector size, in 3D and flat; the food stops
// tumbling when motion is reduced.

const BODY_MEAL = '/sim?v=3&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1'

test('organ labels never overlap and stay inside the body picture', async ({ page }) => {
  onlyIn('desktop', 'projector', 'phone', 'nowebgl')
  // A returning visitor: the first-run medical note (which takes most of a phone's first screen) is closed.
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  for (const url of [BODY_MEAL, `${BODY_MEAL}&lang=hi`]) {
    await page.goto(url)
    const body = page.getByRole('img', { name: /^(The body|शरीर)/ })
    await expect(body).toBeVisible()
    // With WebGL the flat body shows while the 3D code loads; test the 3D one, once drawn (until then
    // the flat stand-in's labels are on the page too).
    if (test.info().project.name !== 'nowebgl') await expect(page.locator('[data-body="3d"][data-ready]')).toBeVisible({ timeout: 30_000 })
    await bodySettled(page)
    await page.evaluate(() => document.fonts.ready)
    const slider = page.getByRole('slider').first()
    // Start, food in the stomach (40 min), in the small intestine (2 h 30 min), in the colon (15 h).
    for (const [key, times] of [
      ['ArrowRight', 0],
      ['ArrowRight', 4],
      ['ArrowRight', 15],
      ['Shift+ArrowRight', 15],
    ] as const) {
      await slider.press('Home')
      for (let i = 0; i < times; i++) await slider.press(key)
      // The four food-path labels always find a place (liver and pancreas only where there is room);
      // a picture under 200 px tall labels only the active organ (FP-1), none while it is the mouth.
      await expect
        .poll(
          async () => {
            const [height, labels] = [(await body.boundingBox())?.height ?? 0, (await visibleLabels(page)).length]
            return height < 200 ? labels <= 1 : labels >= 4
          },
          { timeout: 15_000, message: 'four labels, or at most the active one on a picture under 200 px' },
        )
        .toBe(true)
      // Read them once the picture has stopped moving them: the same boxes two frames apart (the
      // 3D body places its labels per drawn frame; a camera move or a late font is still settling).
      const labels = await settledLabels(page)
      const frame = (await body.boundingBox())!
      for (const l of labels) {
        expect(l.x, `${l.key} inside`).toBeGreaterThanOrEqual(frame.x - 0.5)
        expect(l.x + l.w, `${l.key} inside`).toBeLessThanOrEqual(frame.x + frame.width + 0.5)
        expect(l.y + l.h, `${l.key} inside`).toBeLessThanOrEqual(frame.y + frame.height + 0.5)
      }
      for (let i = 0; i < labels.length; i++)
        for (let j = i + 1; j < labels.length; j++) {
          const [a, b] = [labels[i]!, labels[j]!]
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
          expect(apart, `${url}: "${a.text}" overlaps "${b.text}"`).toBe(true)
        }
    }
  }
})

test('the food stops tumbling when motion is reduced', async ({ page }) => {
  onlyIn('reduced', 'desktop', 'nowebgl')
  await page.goto('/sim')
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  const reduced = test.info().project.name === 'reduced'
  // Both bodies (3D and flat) say which way their particles are drawn.
  await expect(page.locator('[data-particles]').first()).toHaveAttribute('data-particles', reduced ? 'still' : 'tumbling')
})

/** The organ labels once two reads, two animation frames apart, give the same boxes (or after 5 s). */
async function settledLabels(page: Page) {
  let last = ''
  let labels = await visibleLabels(page)
  for (const end = Date.now() + 5_000; Date.now() < end;) {
    const now = JSON.stringify(labels)
    if (now === last) break
    last = now
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    labels = await visibleLabels(page)
  }
  return labels
}

/** The organ labels that are showing, with their boxes. */
function visibleLabels(page: Page) {
  return page.locator('[data-callout]').evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).visibility === 'visible')
      .map((e) => {
        const r = e.getBoundingClientRect()
        return { key: (e as HTMLElement).dataset.callout, text: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height }
      }),
  )
}

// The v2 stage at /sim (WP-11). These run in every stage.spec project.

/** The address bar's query, decoded. */
const params = (page: Page) => new URL(page.url()).searchParams

test.describe('/sim stage', () => {
  test('shows one body, never two', async ({ page }) => {
    await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: /^The body, digesting/ })).toHaveCount(1)
  })

  test('nothing scrolls at laptop and projector size, in English and Hindi', async ({ page }) => {
    onlyIn('desktop', 'projector', 'nowebgl', 'reduced')
    for (const url of ['/sim?v=3&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1', '/sim?v=3&a=cola:1&b=cheeseburger:1&lang=hi']) {
      await page.goto(url)
      await expect(page.getByRole('img', { name: /^(The body|शरीर)/ })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expectNoPageScroll(page)
    }
  })

  test('on a phone the body, a graph and Play are in the first screen', async ({ page }) => {
    onlyIn('phone')
    for (const url of ['/sim', '/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1&lang=hi']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expectInFirstScreen(page, {
        body: page.getByRole('img', { name: /^(The body|शरीर)/ }),
        graph: page.locator('figure svg[role="img"]').filter({ visible: true }),
        Play: page.getByRole('button', { name: /^(Play|चलाएँ)$/ }),
      })
    }
  })

  test('Keep to compare, then stop comparing', async ({ page }) => {
    await page.goto('/sim')
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await openMealActions(page)
    await page.getByRole('button', { name: 'Keep to compare' }).click()
    // The meal bar's tag comes first; the graphs label their dashed line the same way.
    await expect(page.getByText('Kept: Cola', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    await expect.poll(() => params(page).get('b')).toBe('cola:1')
    // The same meal can't be kept twice. (On a phone Keep is in "⋯", which closed when it was used: FP-5.)
    await openMealActions(page)
    await expect(page.getByRole('button', { name: 'Keep to compare' })).toBeDisabled()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Stop comparing with Cola' }).click()
    await expect(page.getByText('Kept: Cola', { exact: true })).toHaveCount(0)
    await expect.poll(() => params(page).has('b')).toBe(false)
  })

  test('a link with a kept run opens with its tag', async ({ page }) => {
    await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByText('Kept: Cheeseburger + French fries', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    await page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1&lang=hi')
    await expect(
      page
        .getByText(/^रखा गया भोजन: .+ \+ .+$/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible()
  })

  test('adding a food updates the link', async ({ page }) => {
    await page.goto('/sim')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('combobox').fill('fries')
    await sheet.getByRole('combobox').press('Enter')
    await expect(sheet).toBeHidden()
    await showChip(page, /^French fries, Servings 1$/)
    await expect.poll(() => params(page).get('a')).toBe('cola:1,fries:1')
  })

  test('a meal can’t grow past the cap, and says why', async ({ page }) => {
    await page.goto('/sim?v=3&a=cheeseburger:4')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await sheet.getByRole('option', { name: /French fries/ }).click()
    await expect(sheet.getByRole('alert')).toContainText('bigger than 1500 kcal')
    await expect(sheet).toBeVisible()
    expect(params(page).get('a')).toBe('cheeseburger:4')
  })

  test('a link from a newer version says so (English and Hindi)', async ({ page }) => {
    await page.goto('/sim?v=3&a=cola:1&o=frog')
    await expect(page.getByRole('note').filter({ hasText: 'made with a newer version of LifePeek' })).toBeVisible()
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await page.goto('/sim?v=3&a=cola:1&o=frog&lang=hi')
    await expect(page.getByRole('note').filter({ hasText: 'LifePeek के नए संस्करण' })).toBeVisible()
  })
})

/** What the 3D body holds on the GPU and in three/mount.ts's cache (BodyCanvas puts both on window). */
function gpu(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __lifepeekGl: { memory: { geometries: number; textures: number }; programs?: unknown[] }
      __lifepeek3d: () => { layers: string[]; builds: number; uploaded: number; bytes: number }
    }
    const { geometries, textures } = w.__lifepeekGl.memory
    return { geometries, textures, programs: w.__lifepeekGl.programs?.length ?? -1, ...w.__lifepeek3d() }
  })
}

test('switching systems 20× leaves one WebGL context and the 3D body at its base (A-0 3D)', async ({ page }) => {
  onlyIn('desktop', 'phone')
  test.setTimeout(300_000)
  // Every WebGL context the page makes, so a leaked one (made and never lost) shows. lib/webgl.ts's
  // probe makes one, once, off the page: `onPage` counts only the bodies' live contexts.
  await page.addInitScript(() => {
    const made: WebGLRenderingContext[] = []
    Object.assign(window, { __lpContexts: made })
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = (get as (...a: unknown[]) => unknown).call(this, type, ...rest)
      if (ctx && type.startsWith('webgl') && !made.includes(ctx as WebGLRenderingContext)) made.push(ctx as WebGLRenderingContext)
      return ctx
    } as typeof get
  })
  const contexts = () =>
    page.evaluate(() => {
      const made = (window as unknown as { __lpContexts: WebGLRenderingContext[] }).__lpContexts
      const live = made.filter((c) => !c.isContextLost())
      return { live: live.length, onPage: live.filter((c) => (c.canvas as HTMLCanvasElement).isConnected).length }
    })
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim?v=3&a=cola:1&preview=1')
  const ready = page.locator('[data-body="3d"][data-ready]')
  await expect(ready).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1000)
  const base = await gpu(page)
  expect(base.layers).toEqual(['high:digestion'])
  const first = await contexts()
  expect(first.onPage).toBe(1)
  for (let i = 0; i < 20; i++) {
    // `[`: the row before, round the list (Skin, drawn flat: the 3D body goes); `]`: back to digestion.
    // (Breathing, the row after, has a 3D layer since A-3: the 3D-to-3D swap is the next test.)
    await page.locator('body').press('[')
    await expect(page.locator('[data-layer="skin"]')).toBeAttached({ timeout: 30_000 })
    await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
    if (i === 0 || i === 19) {
      // No body on the page: nothing we cache is still known to a renderer (it would keep an old context alive).
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => (window as unknown as { __lifepeek3d: () => { uploaded: number } }).__lifepeek3d())).uploaded,
        )
        .toBe(0)
      await expect.poll(contexts).toEqual({ live: first.live - 1, onPage: 0 })
    }
    await page.locator('body').press(']')
    await expect(ready).toBeVisible({ timeout: 30_000 })
  }
  await page.waitForTimeout(1000)
  // One context on the page, and none left over from the 20 bodies before it.
  expect(await contexts()).toEqual(first)
  await expect(page.locator('[data-body="3d"] canvas')).toHaveCount(1)
  const after = await gpu(page)
  // Geometries, textures and programs back at base; digestion's mesh was built once, its arrays cached.
  expect(after).toEqual(base)
})

/** The renderer's last frame: draw calls and triangles (anatomy plan §9 counts what is rendered). */
const rendered = (page: Page) =>
  page.evaluate(() => {
    const r = (window as unknown as { __lifepeekGl: { render: { calls: number; triangles: number } } }).__lifepeekGl.render
    return { calls: r.calls, triangles: r.triangles }
  })

test('digestion, breathing, the heart and the kidneys swap their 3D layers in one canvas: one context, the GPU back at base (A-3, A-5, A-6, R99)', async ({
  page,
}) => {
  onlyIn('desktop', 'phone')
  test.setTimeout(420_000)
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim?v=3&a=roti:1&act=walk.30.20&layer=digestion&preview=1&t=40')
  const body = page.locator('[data-body="3d"][data-ready]')
  await expect(body).toBeVisible({ timeout: 30_000 })
  await expect(body).toHaveAttribute('data-layer', 'digestion')
  // The canvas this body draws in: the very same element (so the same WebGL context) after every swap.
  await page.locator('[data-body="3d"] canvas').evaluate((c) => Object.assign(c, { lpFirst: true }))
  const sameCanvas = () =>
    page.evaluate(() => ({
      tagged: [...document.querySelectorAll('[data-body="3d"] canvas')].filter((c) => (c as unknown as { lpFirst?: boolean }).lpFirst)
        .length,
      onPage: document.querySelectorAll('[data-body="3d"] canvas').length,
    }))
  await page.waitForTimeout(1000)
  const base = await gpu(page)
  expect(base.layers).toEqual(['high:digestion'])
  const lungs = page.locator('[data-body="3d"][data-layer="breathing"][data-breath]')
  const heart = page.locator('[data-body="3d"][data-layer="circulation"][data-beat]')
  const kidneys = page.locator('[data-body="3d"][data-layer="kidneys"][data-drops]')
  /** Anatomy plan §9, high tier: at most 150k triangles and 60 draw calls rendered. */
  const withinGpu = async () => {
    await page.waitForTimeout(800)
    const gl = await rendered(page)
    expect(gl.calls).toBeLessThanOrEqual(60)
    expect(gl.triangles).toBeLessThanOrEqual(150_000)
  }
  // `]` lights the row after (digestion, breathing, Heart & blood, Kidneys & water), `[` the row before.
  for (let i = 0; i < 4; i++) {
    await page.locator('body').press(']')
    await expect(lungs).toBeVisible({ timeout: 30_000 })
    // The chest framing; the lungs breathe at the run's rate, at most 0.8 a second.
    await expect(lungs).toHaveAttribute('data-framing', 'chest')
    expect(Number(await lungs.getAttribute('data-breath-hz'))).toBeLessThanOrEqual(0.8)
    if (i === 0) await withinGpu()
    expect(await sameCanvas()).toEqual({ tagged: 1, onPage: 1 })
    await page.locator('body').press(']')
    await expect(heart).toBeVisible({ timeout: 30_000 })
    // The torso framing (the legs' vessels show); the heart beats at the run's rate, at most 2.5 a second; the breath's attributes went with its layer.
    await expect(heart).toHaveAttribute('data-framing', 'torso')
    expect(Number(await heart.getAttribute('data-beat-hz'))).toBeLessThanOrEqual(2.5)
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-breath', /.*/)
    if (i === 0) await withinGpu()
    expect(await sameCanvas()).toEqual({ tagged: 1, onPage: 1 })
    await page.locator('body').press(']')
    await expect(kidneys).toBeVisible({ timeout: 30_000 })
    // The torso framing too; the bladder drawn at most 600 mL; the beat's attributes went with its layer.
    await expect(kidneys).toHaveAttribute('data-framing', 'torso')
    await expect(kidneys).toHaveAttribute('data-bladder-drawn', /^\d+$/)
    expect(Number(await kidneys.getAttribute('data-bladder-drawn'))).toBeLessThanOrEqual(600)
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-beat', /.*/)
    if (i === 0) await withinGpu()
    expect(await sameCanvas()).toEqual({ tagged: 1, onPage: 1 })
    await page.locator('body').press('[')
    await expect(heart).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-drops', /.*/)
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-bladder-drawn', /.*/)
    await page.locator('body').press('[')
    await expect(lungs).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-beat', /.*/)
    await page.locator('body').press('[')
    await expect(page.locator('[data-body="3d"][data-layer="digestion"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-body="3d"]')).not.toHaveAttribute('data-breath', /.*/)
    expect(await sameCanvas()).toEqual({ tagged: 1, onPage: 1 })
  }
  await page.waitForTimeout(1000)
  const after = await gpu(page)
  // Geometries, textures and programs back at base: the lungs', the heart's and the kidneys' buffers
  // and programs were freed. Four layers through a 2-layer cache: some were built again; at most two stay, digestion with them.
  expect({ ...after, layers: [], bytes: 0, builds: 0 }).toEqual({ ...base, layers: [], bytes: 0, builds: 0 })
  expect(after.layers).toContain('high:digestion')
  expect(after.layers.length).toBeLessThanOrEqual(2)
  expect(after.bytes).toBeLessThanOrEqual(4_000_000)
})

test('no WebGL: breathing is drawn flat and its 3D layer never loads (R43)', async ({ page }) => {
  onlyIn('nowebgl')
  const loaded: string[] = []
  page.on('request', (r) => {
    if (/layer3d-/.test(r.url())) loaded.push(r.url())
  })
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim?v=3&a=roti:1&act=walk.30.20&layer=breathing&preview=1&t=40')
  await expect(page.locator('[data-body="flat"][data-framing="chest"] [data-layer="breathing"]')).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
  expect(loaded).toEqual([])
})

test('no WebGL: Heart & blood is drawn flat and its 3D layer never loads (R43)', async ({ page }) => {
  onlyIn('nowebgl')
  const loaded: string[] = []
  page.on('request', (r) => {
    if (/layer3d-/.test(r.url())) loaded.push(r.url())
  })
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim?v=3&a=roti:1&act=walk.30.20&layer=circulation&preview=1&t=40')
  await expect(page.locator('[data-body="flat"][data-framing="torso"] [data-layer="circulation"]')).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
  expect(loaded).toEqual([])
})

test('no WebGL: Kidneys & water is drawn flat and its 3D layer never loads (R43)', async ({ page }) => {
  onlyIn('nowebgl')
  const loaded: string[] = []
  page.on('request', (r) => {
    if (/layer3d-/.test(r.url())) loaded.push(r.url())
  })
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim?v=3&a=water:2&layer=kidneys&preview=1&t=80')
  await expect(page.locator('[data-body="flat"][data-framing="torso"] [data-layer="kidneys"]')).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
  expect(loaded).toEqual([])
})
