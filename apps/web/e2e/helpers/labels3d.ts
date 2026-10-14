import type { Page } from '@playwright/test'
import type { Layer3d } from '../../src/three/layer.ts'

/**
 * The 3D body's organ labels after the view is turned (R106): each shown label's leader dot against
 * where its organ's anchor is on screen, projected here with the camera's matrices as last drawn and
 * the canvas's box (never the app's own projection). Shared by the system specs whose 3D layer has
 * its own labels (Heart & blood, Kidneys & water, Breathing).
 */

/** How far a dot may be from its organ's projected anchor (CSS px): the dot's own radius and rounding. */
const MAX_LABEL_OFF_PX = 6

type Anchors = Record<string, [number, number, number]>

/** A 3D layer's label anchors (scene units), by label key. */
export const anchorsOf = (layer: Layer3d): Anchors =>
  Object.fromEntries(Object.entries(layer.labels!.table).map(([k, c]) => [k, [c.anchor.x, c.anchor.y, c.anchor.z]]))

/** Each shown label's dot's distance (px) from its organ, projected with the camera as last drawn. */
function labelOffsets(page: Page, anchors: Anchors): Promise<{ id: string; off: number }[]> {
  return page.evaluate((anchors) => {
    const body = document.querySelector('[data-body="3d"][data-ready]')
    const canvas = body?.querySelector('canvas')
    const camera = (
      window as { __lifepeekCamera?: { matrixWorldInverse: { elements: number[] }; projectionMatrix: { elements: number[] } } }
    ).__lifepeekCamera
    if (!body || !canvas || !camera) return []
    const c = canvas.getBoundingClientRect()
    const mul = (m: number[], v: number[]) =>
      [0, 1, 2, 3].map((r) => m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]! * v[3]!)
    const leaders = [...body.querySelectorAll('[data-leader]')]
    const callouts = body.querySelectorAll('[data-callout]')
    const out: { id: string; off: number }[] = []
    leaders.forEach((g, i) => {
      if (g.getAttribute('visibility') !== 'visible') return
      const id = callouts[i]?.getAttribute('data-callout')
      const anchor = id ? anchors[id] : undefined
      const dot = g.querySelector('circle')?.getBoundingClientRect()
      if (!id || !anchor || !dot) return
      const clip = mul(camera.projectionMatrix.elements, mul(camera.matrixWorldInverse.elements, [...anchor, 1]))
      const x = c.left + ((clip[0]! / clip[3]! + 1) / 2) * c.width
      const y = c.top + ((1 - clip[1]! / clip[3]!) / 2) * c.height
      out.push({ id, off: Math.hypot(dot.left + dot.width / 2 - x, dot.top + dot.height / 2 - y) })
    })
    return out
  }, anchors)
}

/** The camera's view matrix as last drawn, rounded (whether the view turned). */
const viewKey = (page: Page) =>
  page.evaluate(() =>
    ((window as { __lifepeekCamera?: { matrixWorldInverse: { elements: number[] } } }).__lifepeekCamera?.matrixWorldInverse.elements ?? [])
      .map((v) => v.toFixed(3))
      .join(),
  )

/**
 * Turns the view with a pointer drag across the canvas's middle, as a reader would, and checks the
 * labels at every step (R106): while the pointer is still down, while the controls' damping lets the
 * turn run out after it is lifted, and after. Returns what is wrong: a dot further than
 * MAX_LABEL_OFF_PX from its organ, no label to check, or a view that did not turn.
 */
export async function labelsOffWhileTurning(page: Page, anchors: Anchors, { dx = 160, dy = 40 } = {}): Promise<string[]> {
  const problems: string[] = []
  let checked = 0
  const look = async (when: string) => {
    for (const { id, off } of await labelOffsets(page, anchors)) {
      checked++
      if (off > MAX_LABEL_OFF_PX) problems.push(`${when}: ${id} label's dot is ${off.toFixed(1)} px from its organ`)
    }
  }
  await look('before')
  const before = await viewKey(page)
  const box = (await page.locator('[data-body="3d"][data-ready] canvas').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  for (let i = 0; i < 4; i++) {
    await look(`dragging, ${i * 150} ms`)
    await page.waitForTimeout(150)
  }
  await page.mouse.up()
  for (let i = 0; i < 4; i++) {
    await look(`after the drag, ${i * 200} ms`)
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(1500)
  await look('a while after')
  if ((await viewKey(page)) === before) problems.push('the drag did not turn the view')
  if (!checked) problems.push('no label was shown to check')
  return problems
}
