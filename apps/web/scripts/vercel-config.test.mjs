import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The deployed site's headers and rewrites live in the root vercel.json (verify-1 P6, 03 WP-22).
// Playwright runs against `vite preview`, which never applies them, so this test is their only guard.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))

/** The headers sent with every path (the block whose source is "/(.*)"), by lower-case name. */
const everyPath = new Map(
  (vercel.headers ?? []).filter((h) => h.source === '/(.*)').flatMap((h) => h.headers.map(({ key, value }) => [key.toLowerCase(), value])),
)

/** "a b; c d" → { a: 'b', c: 'd' } */
const directives = (csp) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...rest] = d.split(/\s+/)
        return [name, rest.join(' ')]
      }),
  )

describe('vercel.json security headers', () => {
  it('every path gets nosniff and a referrer policy', () => {
    expect(everyPath.get('x-content-type-options')).toBe('nosniff')
    expect(everyPath.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('no other site can frame the app', () => {
    const csp = directives(everyPath.get('content-security-policy') ?? '')
    expect(csp['frame-ancestors']).toBe("'none'")
    expect(everyPath.get('x-frame-options')).toBe('DENY')
  })

  it('the CSP stays minimal: nothing that could block scripts, styles, workers, WebGL, fonts or stats.json', () => {
    // A fuller CSP needs a check against the deployed site first (inline styles, blob: workers,
    // the service worker, /stats.json). Until then only these directives, which load nothing.
    const csp = directives(everyPath.get('content-security-policy') ?? '')
    expect(Object.keys(csp).sort()).toEqual(['base-uri', 'frame-ancestors', 'object-src'])
  })

  it('camera, microphone and location are switched off', () => {
    const policy = everyPath.get('permissions-policy') ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation']) expect(policy).toContain(`${feature}=()`)
  })
})

describe('vercel.json rewrites', () => {
  it('only app routes fall back to index.html; files and the API are served as they are', () => {
    expect(vercel.rewrites).toHaveLength(1)
    const [{ source, destination }] = vercel.rewrites
    expect(destination).toBe('/index.html')
    // Same list as Workbox's navigateFallbackDenylist in vite.config.ts (00 D-NOTICES).
    const served = ['api/', 'assets/', 'sw.js', 'workbox-', 'manifest.webmanifest', 'favicon', 'icon-', 'THIRD_PARTY_NOTICES']
    for (const name of [...served, 'robots.txt', 'sitemap.xml', 'stats.json']) expect(source).toContain(name)
    const pattern = new RegExp(`^${source}$`)
    for (const route of ['/', '/sim', '/next', '/teach', '/privacy']) expect(pattern.test(route), route).toBe(true)
    for (const file of ['/stats.json', '/THIRD_PARTY_NOTICES.txt', '/sw.js', '/robots.txt', '/api/feedback']) {
      expect(pattern.test(file), file).toBe(false)
    }
  })
})
