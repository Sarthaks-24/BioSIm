import { inflateSync } from 'node:zlib'

/**
 * A tiny PNG reader for Playwright screenshots (8-bit RGB or RGBA, not interlaced), so a test can
 * look at pixels without an image library. Returns the grey value (0 black … 255 white) of each
 * pixel, by Rec. 709 luma, as a greyscale photocopy or a colour-blind reader would see brightness.
 */
export function greyPixels(png: Buffer): { width: number; height: number; grey: (x: number, y: number) => number } {
  if (png.readUInt32BE(12) !== 0x49484452) throw new Error('not a PNG')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const depth = png[24]
  const type = png[25]
  if (depth !== 8 || (type !== 2 && type !== 6) || png[28] !== 0) throw new Error(`unsupported PNG (depth ${depth}, type ${type})`)
  const channels = type === 6 ? 4 : 3

  const idat: Buffer[] = []
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at)
    const kind = png.toString('latin1', at + 4, at + 8)
    if (kind === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length))
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[y * stride + i - channels]! : 0
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0
      const c = y > 0 && i >= channels ? out[(y - 1) * stride + i - channels]! : 0
      const p = a + b - c
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      const predict = [0, a, b, (a + b) >> 1, paeth][filter]
      if (predict === undefined) throw new Error(`bad PNG filter ${filter}`)
      out[y * stride + i] = (line[i]! + predict) & 0xff
    }
  }
  return {
    width,
    height,
    grey: (x, y) => {
      const i = Math.round(y) * stride + Math.round(x) * channels
      return 0.2126 * out[i]! + 0.7152 * out[i + 1]! + 0.0722 * out[i + 2]!
    },
  }
}
