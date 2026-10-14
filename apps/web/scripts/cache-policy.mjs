// The service worker's caching policy in one place (R71 "load on demand, small cache"; vite.config.ts
// passes `workboxPolicy` as VitePWA's `workbox`). Which file is in which tier is scripts/cache-tiers.mjs.
//   - precache (at install): the core tier only: the shell, every page's code with the stage, the
//     engine and digestion's pack, the English core text, the latin woff2 fonts, the icons, the
//     resting body, pack-manifest.json. The lazy tier is left out (globIgnores, generated from it once
//     the bundle is written, and `manifestTransform`, which keeps of the hashed files only the core),
//     and nothing over 512 KB gets in (a tripwire).
//   - "lp-lazy" (CacheFirst on first use): the 3D body, the stage's on-use parts, the "new version"
//     note, the latin-ext fonts, every other system pack, Hindi. Hashed /assets/ files only, so a
//     kept file is never stale; two versions of the lazy tier (LAZY_MAX_ENTRIES, 150 files), 90
//     days, emptied first when the device runs short of space.
//   - "lp-saved" (read first by the same route): what Teach's "Save for class offline" saved ahead
//     of class. No expiration and no limit, so casual use never pushes a saved lesson out (R120 #1);
//     the Teach page removes a past version's files (lib/offlineSave.ts).
//   - "stats" (NetworkFirst): stats.json, which changes weekly without a new app version.
//   - never cached: the share image, the install screenshots, robots, sitemap, notices, /api, the
//     per-page HTML and the 404 page (for the server; offline, index.html serves every page).
import { LAZY_CACHE, LAZY_MAX_ENTRIES } from './cache-tiers.mjs'

/**
 * Workbox's options. `tiers`: the cache-tiers plugin (scripts/cache-tiers.mjs), which knows the
 * tiers only once the bundle is written, before the service worker is generated. `hindi`: Hindi is
 * in this build (R47).
 */
export function workboxPolicy({ hindi, tiers }) {
  const globIgnores = [
    '**/node_modules/**/*',
    // stats.json changes every week without a new app version: the network first, and offline the
    // last copy fetched (the /stats page). The share image and the install screenshots are for
    // other sites and the install dialog, never drawn by the app offline (precache budget).
    'stats.json',
    'og-image.png',
    'screenshots/**',
    // The per-page HTML and the 404 page are for the server (scripts/prerender-head.mjs);
    // offline, the service worker serves index.html for every page.
    '*/index.html',
    '404.html',
    // Without Hindi, Hindi's font (about 138 KB) is not even in the build; this keeps it out
    // should anything bring it back.
    ...(hindi ? [] : ['**/noto-sans-devanagari*']),
  ]
  // The lazy tier joins these once the bundle is written (R71: globIgnores from the lazy list).
  tiers.ignoreLazyIn(globIgnores)
  return {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
    globIgnores,
    manifestTransforms: [tiers.manifestTransform],
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/stats.json',
        handler: 'NetworkFirst',
        options: { cacheName: 'stats', networkTimeoutSeconds: 5, expiration: { maxEntries: 1 } },
      },
      {
        // Lazy files, the first time they are used: hashed names under /assets/ only, never a .woff
        // fallback. Not the share image, screenshots, robots, sitemap, notices or /api: they are not here.
        // Workbox copies this function's text into sw.js, so the pattern is written out here (no
        // outside names): it is cache-tiers.mjs's LAZY_URL, which a test checks.
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css|woff2|svg|png)$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: LAZY_CACHE,
          cacheableResponse: { statuses: [200] },
          // A module script asks with an Origin header and a server may answer "Vary: Origin"
          // (vite preview does): a copy saved by Teach's "Save for class offline" (no Origin)
          // must still match. Same-origin files with hashed names: one answer per name.
          matchOptions: { ignoreVary: true },
          // Two versions of every lazy part (cache-tiers.mjs checks the lazy tier fits twice); old versions age out.
          expiration: { maxEntries: LAZY_MAX_ENTRIES, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true },
          // After the expiration plugin (plugins run in this order): a file Teach saved for class
          // (lp-saved, cache-tiers.mjs SAVED_CACHE) is used first, then lp-lazy's copy, then the
          // network. Workbox copies the function's text into sw.js, so the cache's name is written out.
          plugins: [
            {
              cachedResponseWillBeUsed: async ({ request, cachedResponse }) =>
                (await (await caches.open('lp-saved')).match(request, { ignoreVary: true })) || cachedResponse,
            },
          ],
        },
      },
    ],
    // A tripwire (R71): no precached file over 512 KB. The 3D body (about 970 KB) is lazy.
    maximumFileSizeToCacheInBytes: 512 * 1024,
    // Plain files that must reach the server, not the app shell.
    navigateFallbackDenylist: [
      /^\/api\//,
      /^\/THIRD_PARTY_NOTICES\.txt$/,
      /^\/robots\.txt$/,
      /^\/sitemap\.xml$/,
      /^\/stats\.json$/,
      /^\/og-image\.png$/,
      /^\/screenshots\//,
    ],
  }
}
