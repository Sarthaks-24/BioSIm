import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTE_TITLES } from '../src/lib/routeMeta.ts'

// The deployed site's headers and rewrites live in the root vercel.json (verify-1 P6, 03 WP-22).
// Playwright runs against `vite preview`, which sends the same "/(.*)" headers (vite.config.ts, lifepeek-site-headers).
// Unknown paths get a real 404 (T12b): Vercel serves dist/404.html (scripts/prerender-head.mjs)
// with status 404 for any path that is no file and no rewrite.
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

  it('the CSP: only the site itself, for every kind of file (R120 #10)', () => {
    // No third parties (R74): scripts, styles, workers, fonts, the web manifest, fetches (stats.json,
    // pack-manifest.json, /api) and forms are the site's own. Images: the site's, data: (the QR and
    // the worksheet's pictures) and blob:. React's style props are set through the CSSOM, which the
    // policy does not block, so style-src needs no 'unsafe-inline' (e2e/web-basics.spec.ts checks
    // every page, the 3D body, the worker and Teach under it, with vite preview sending this header).
    const csp = directives(everyPath.get('content-security-policy') ?? '')
    expect(csp).toEqual({
      'default-src': "'self'",
      'script-src': "'self'",
      'style-src': "'self'",
      'img-src': "'self' data: blob:",
      'connect-src': "'self'",
      'worker-src': "'self'",
      'font-src': "'self'",
      'manifest-src': "'self'",
      'form-action': "'self'",
      'frame-ancestors': "'none'",
      'object-src': "'none'",
      'base-uri': "'self'",
    })
  })

  it('camera, microphone and location are switched off', () => {
    const policy = everyPath.get('permissions-policy') ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation']) expect(policy).toContain(`${feature}=()`)
  })
})

describe('vercel.json pages, redirect and 404 (T12b)', () => {
  // The pages of the route-meta table (src/lib/routeMeta.ts), each with its built HTML
  // (scripts/prerender-head.mjs); "/" is dist/index.html itself.
  const pages = Object.keys(ROUTE_TITLES).filter((p) => p !== '/')
  /** The destination a path is rewritten to, or null (Vercel then serves a file, or 404.html with status 404). */
  const rewrite = (url) => {
    for (const { source, destination } of vercel.rewrites ?? []) {
      // Plain paths only: a pattern here could catch unknown paths again (a soft 404).
      if (source === url) return destination
    }
    return null
  }

  it('only the known pages are rewritten, each to its own built HTML; nothing else falls back to the app', () => {
    for (const { source } of vercel.rewrites) expect(source, 'a plain path, no pattern').toMatch(/^\/[a-z]+$/)
    expect(vercel.rewrites.map((r) => r.source).sort()).toEqual(pages.sort())
    for (const page of pages) expect(rewrite(page), page).toBe(`${page}/index.html`)
    for (const path of [
      '/nope',
      '/sim/x',
      '/teach/old',
      '/stage',
      '/api/feedback',
      '/stats.json',
      '/og-image.png',
      '/sw.js',
      '/THIRD_PARTY_NOTICES.txt',
    ])
      expect(rewrite(path), path).toBeNull()
  })

  it("/next, the stage's old address, is a 301 to /sim (the query is kept by Vercel)", () => {
    expect(vercel.redirects).toEqual([{ source: '/next', destination: '/sim', statusCode: 301 }])
  })
})

describe('the service worker sends plain files to the network', () => {
  it('never the app shell for the API, notices, robots, sitemap, stats, the share image or screenshots (scripts/cache-policy.mjs)', () => {
    const vite = fs.readFileSync(path.join(root, 'apps', 'web', 'scripts', 'cache-policy.mjs'), 'utf8')
    const start = vite.indexOf('navigateFallbackDenylist')
    const deny = vite.slice(start, vite.indexOf('],', start))
    for (const name of ['api', 'THIRD_PARTY_NOTICES', 'robots', 'sitemap', 'stats', 'og-image', 'screenshots']) {
      expect(deny, `${name} in navigateFallbackDenylist`).toContain(name)
    }
  })
})
