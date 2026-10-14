// The Teach page's QR code, made at build time from the site address (T11, R79).
//
// The QR code is a picture of `<VITE_SITE_URL><QR_PATH>` (scripts/site-url.mjs, src/lib/qrPath.ts):
// a build with another address (the real Vercel name, a custom domain) gets a QR code that opens
// that address, with no hand step. This Vite plugin writes src/assets/lifepeek-qr.svg when a build
// or the dev server starts (before any page is read; the file is not committed, .gitignore), and
// pages/Teach.tsx imports it as a file of its own, as before (never inlined into its code).
//
// qrcode@1.5.4 (exact, a devDependency) runs only here, in Node: nothing of it reaches the app's
// JavaScript (size budget). Error correction M and a 4-module quiet zone, as the hand-made file had
// (D-QR). Privacy: no third party, nothing collected; the picture is a plain SVG (CSP unchanged).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { QR_PATH } from '../src/lib/qrPath.ts'

/** Where the picture is written; pages/Teach.tsx imports it. */
export const QR_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'lifepeek-qr.svg')

/** The address the QR code opens on a site at `site` (no trailing slash). */
export const qrAddress = (site) => site + QR_PATH

/** The QR code of `address` as an SVG (black on white, error correction M, quiet zone 4). */
export function qrSvg(address) {
  return QRCode.toString(address, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/** Writes `file` with the QR code of `address`, unless it already holds exactly that. */
export async function writeQr(address, file = QR_FILE) {
  const svg = await qrSvg(address)
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === svg) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, svg)
  return true
}

/** The Vite plugin: the QR code of this build's site address, before any module is read. */
export default function qrCode({ site }) {
  return {
    name: 'lifepeek-qr-code',
    async buildStart() {
      await writeQr(qrAddress(site))
    },
  }
}
