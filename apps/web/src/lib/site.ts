/**
 * The production address: VITE_SITE_URL, or the planned name, without a trailing slash. Set once, at
 * build time (scripts/site-url.mjs, vite.config.ts `define`), for canonical links, og:url, the
 * sitemap and robots.txt alike (T12a).
 */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL

/** The public repository: licence files, issues. */
export { REPO_URL } from '../../scripts/site-url.mjs'
