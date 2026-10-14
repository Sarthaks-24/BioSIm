/**
 * Renders the PWA PNG icons from the logo geometry with no native dependencies.
 * Run: node apps/web/scripts/make-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const PAPER = [0xee, 0xf3, 0xf1]
const TISSUE = [0xd9, 0x53, 0x6a]
const INK = [0x14, 0x21, 0x3d]

// Logo path from favicon.svg, sampled as a polyline in a 32×32 box.
function cubic(p0, p1, p2, p3, n = 24) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return out
}
const pts = [
  [11, 3],
  [11, 9],
  ...cubic([11, 9], [11, 12], [13, 13], [16, 13]),
  [19, 13],
  ...cubic([19, 13], [23, 13], [26, 16], [26, 20]),
  ...cubic([26, 20], [26, 24], [23, 28], [17, 28]),
  ...cubic([17, 28], [12, 28], [8, 25], [8, 21]),
  ...cubic([8, 21], [8, 18], [10, 16], [13, 16]),
]

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/**
 * One icon, `size` px square. `scale` < 1 draws the mark smaller in the middle of the same paper:
 * the maskable icon's mark must sit inside the central circle (radius 40 % of the icon) that every
 * Android mask keeps (web audit 2026-10-14: icon-512's mark reached the edge and was cropped).
 */
function render(size, scale = 1) {
  const s = (size / 32) * scale
  const offset = (32 - 32 / scale) / 2
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / s + offset
      const py = (y + 0.5) / s + offset
      let d = Infinity
      for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSegment(px, py, pts[i - 1], pts[i]))
      const dot = Math.hypot(px - 13, py - 20)
      // Simple 1-pixel anti-aliasing at the stroke edge.
      const strokeA = Math.max(0, Math.min(1, (2 - d) * s + 0.5))
      const dotA = Math.max(0, Math.min(1, (2.2 - dot) * s + 0.5))
      const c = PAPER.map((p, k) => {
        const withStroke = p * (1 - strokeA) + TISSUE[k] * strokeA
        return Math.round(withStroke * (1 - dotA) + INK[k] * dotA)
      })
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = c[0]
      raw[o + 1] = c[1]
      raw[o + 2] = c[2]
      raw[o + 3] = 255
    }
  }
  return png(size, raw)
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const pub = fileURLToPath(new URL('../public/', import.meta.url))
for (const size of [192, 512]) writeFileSync(`${pub}icon-${size}.png`, render(size))
// The mark's farthest point (the top of the stroke) is 15.8 units from the centre: at 0.7 it is
// 35 % of the icon from the centre, inside the 40 % safe zone.
writeFileSync(`${pub}icon-maskable-512.png`, render(512, 0.7))
console.log('icons written')
