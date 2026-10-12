import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatmullRomCurve3, Vector3 } from 'three'
import * as human from './human.ts'
import { Spline3, Vec3 } from './spline.ts'

/** Every curve the anatomy exports, by name. */
const curves = Object.entries(human).filter((e): e is [string, Spline3] => e[1] instanceof Spline3)

/** The same curve built with three.js, as the anatomy was before spline.ts. */
const threeOf = (c: Spline3) =>
  new CatmullRomCurve3(
    c.points.map((p) => new Vector3(p.x, p.y, p.z)),
    false,
    'catmullrom',
    c.tension,
  )

describe('Spline3 (anatomy curves without three.js)', () => {
  it('covers every anatomy curve', () => {
    expect(curves.map(([name]) => name).sort()).toEqual(
      ['APPENDIX', 'ARM', 'ESOPHAGUS', 'LARGE_INTESTINE', 'PANCREAS', 'PHARYNX', 'SMALL_INTESTINE', 'STOMACH'].sort(),
    )
  })

  it.each(curves)('%s: points and tangents are bit-for-bit those of three.CatmullRomCurve3', (_name, curve) => {
    const ref = threeOf(curve)
    const a = new Vec3()
    const b = new Vector3()
    for (let i = 0; i <= 1000; i++) {
      const u = i / 1000
      for (const [ours, theirs] of [
        [curve.getPoint(u, a), ref.getPoint(u, b)],
        [curve.getPointAt(u, a), ref.getPointAt(u, b)],
        [curve.getTangentAt(u, a), ref.getTangentAt(u, b)],
      ] as const) {
        expect([ours.x, ours.y, ours.z]).toEqual([theirs.x, theirs.y, theirs.z])
      }
    }
  })

  it("writes into three.js's own Vector3 (the 3D body passes them)", () => {
    const v = human.STOMACH.getPointAt(1, new Vector3())
    expect(v).toBeInstanceOf(Vector3)
    expect(v.toArray()).toEqual(threeOf(human.STOMACH).getPointAt(1).toArray())
  })
})

it('only the 3D body (src/three) imports three.js, so the pages load none of it (check-budget.mjs)', () => {
  const src = join(import.meta.dirname, '..')
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  const offenders = files.filter(
    (f) => !f.startsWith('three') && /from '(three|@react-three\/[^']+)(\/[^']*)?'/.test(readFileSync(join(src, f), 'utf8')),
  )
  expect(offenders).toEqual([])
})
