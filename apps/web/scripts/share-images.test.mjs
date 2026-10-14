import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The pictures in public/ that other sites and the install dialog show (T12c, R72): small, and in
// formats every link preview reads (PNG and JPEG, no WebP: R73).
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const bytes = (file) => fs.readFileSync(path.join(pub, file))
/** A PNG's width and height (its IHDR). */
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)]

describe('public images', () => {
  it('the share picture is a 1200 × 630 PNG of at most 80 KB', () => {
    const og = bytes('og-image.png')
    expect(og.subarray(1, 4).toString()).toBe('PNG')
    expect(pngSize(og)).toEqual([1200, 630])
    expect(og.length).toBeLessThanOrEqual(80 * 1000)
  })

  it('the install screenshots are JPEGs of at most 110 KB', () => {
    for (const f of ['screenshots/wide.jpg', 'screenshots/narrow.jpg']) {
      const jpg = bytes(f)
      expect(jpg.readUInt16BE(0), f).toBe(0xffd8)
      expect(jpg.length, f).toBeLessThanOrEqual(110 * 1000)
    }
  })

  it('the maskable icon is its own 512 px PNG, not the edge-to-edge one', () => {
    const icon = bytes('icon-maskable-512.png')
    expect(pngSize(icon)).toEqual([512, 512])
    expect(icon.equals(bytes('icon-512.png'))).toBe(false)
  })
})
