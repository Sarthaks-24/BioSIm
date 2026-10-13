import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RESTING_H, RESTING_W, restingBodySvg } from './restingBody.ts'

describe('the resting body on Home', () => {
  it('assets/resting-body.svg is what FlatBody draws today (else run: npm run resting-body -w @lifepeek/web)', () => {
    const file = fs.readFileSync(new URL('../assets/resting-body.svg', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    expect(file).toBe(restingBodySvg())
  })

  it('draws the organs, not an empty frame', () => {
    expect(restingBodySvg().match(/<path /g)?.length).toBeGreaterThan(10)
  })
})

describe('Home', () => {
  it('reserves the picture its own size (no shift while it loads)', () => {
    const home = fs.readFileSync(new URL('../pages/Home.tsx', import.meta.url), 'utf8')
    expect(home).toContain(`width={${RESTING_W}} height={${RESTING_H}}`)
  })
})
