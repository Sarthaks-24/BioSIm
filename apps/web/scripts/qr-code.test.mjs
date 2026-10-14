import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { qrAddress, qrSvg, writeQr } from './qr-code.mjs'
import { DEFAULT_SITE_URL } from './site-url.mjs'
import { QR_PATH } from '../src/lib/qrPath.ts'

/** The dark modules of an SVG made by qrcode (its one stroked path). */
const modules = (svg) => /stroke="#000000" d="([^"]+)"/.exec(svg)?.[1] ?? ''
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

describe('Teach QR code at build time (T11, R79)', () => {
  it('opens QR_PATH on the site address', () => {
    expect(qrAddress('https://example.org')).toBe(`https://example.org${QR_PATH}`)
  })

  it('for the planned address, is the expected code (qrcode@1.5.4, level M; versionless path, 37 modules)', async () => {
    const svg = await qrSvg(qrAddress(DEFAULT_SITE_URL))
    expect(sha(modules(svg))).toBe('5fbdcf9ac43230df7f3249cafd37205e52359652aa32452c80094234d343200a')
    expect(svg).toContain('viewBox="0 0 37 37"')
  })

  it('follows the address: another site gets another code, of error level M and a quiet zone of 4', async () => {
    const a = await qrSvg(qrAddress('https://lifepeek.vercel.app'))
    const b = await qrSvg(qrAddress('https://lifepeek.example.org'))
    expect(modules(a)).not.toBe(modules(b))
    const qr = QRCode.create(qrAddress('https://lifepeek.example.org'), { errorCorrectionLevel: 'M' })
    expect(b).toContain(`viewBox="0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}"`)
  })

  it('writes the file only when it changes', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lp-qr-')), 'qr.svg')
    expect(await writeQr('https://example.org/sim', file)).toBe(true)
    expect(await writeQr('https://example.org/sim', file)).toBe(false)
    expect(await writeQr('https://example.org/teach', file)).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toBe(await qrSvg('https://example.org/teach'))
  })
})
