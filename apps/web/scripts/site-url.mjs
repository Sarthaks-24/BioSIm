// The production address, the one build constant for it (T12a, R72; web audit problem 8): canonical
// links, og:url and og:image, the sitemap, robots.txt and the Teach page's address line all come
// from here. Set VITE_SITE_URL (in the Vercel project's environment, or a .env file) once the
// project's real name is known; without it, the planned name below.
//
// The QR code on /teach is a picture of the address too: scripts/qr-code.mjs makes it at build
// time from this value (R79), so a new address needs no hand step.

/** The planned production address, used when VITE_SITE_URL is not set. */
export const DEFAULT_SITE_URL = 'https://lifepeek.vercel.app'

/** The site address from a VITE_SITE_URL value (or the default), without a trailing slash. */
export function siteUrl(value) {
  const url = (value || DEFAULT_SITE_URL).trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/\s]+$/.test(url)) throw new Error(`VITE_SITE_URL must be an address like https://example.org, not "${value}"`)
  return url
}

/** The public repository: licence files, issues (the site's JSON-LD names it too). */
export const REPO_URL = 'https://github.com/Sarthaks-24/lifepeek'
