// The service worker's caching policy in one place (R71 "load on demand, small cache"; vite.config.ts
// spreads `workboxPolicy` into VitePWA's `workbox`). main applies the same policy in T12d; keep the
// two in this one object so they merge as one.
//   - precache (at install): the shell, the core JS/CSS, the routes, /sim with digestion's pack and
//     the engine, the English core text, the latin woff2 fonts, the icons. Everything in the
//     pack-manifest's lazy tier is left out (`dropLazy`), and nothing over 512 KB gets in (a tripwire).
//   - "lp-lazy" (CacheFirst on first use): the 3D body, every other system pack, the picker, Hindi.
//     Hashed /assets/ files only, so a kept file is never stale; ≈ 40 files, 90 days, emptied first
//     when the device runs short of space.
//   - "stats" (NetworkFirst): stats.json, which changes weekly without a new app version.
//   - never cached: the share image, the install screenshots, robots, sitemap, notices, /api.

/** The runtime cache of files loaded on first use. */
export const LAZY_CACHE = 'lp-lazy'

/**
 * Workbox's options, but for the lazy tier's file list, which only exists once the bundle is
 * written: `lazy` is filled then (vite.config.ts), before the service worker is generated.
 * `hindi`: Hindi is in this build (R47).
 */
export function workboxPolicy({ hindi, lazy }) {
  return {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
    // Without Hindi, Hindi's font (about 138 KB) is not even in the build; this keeps it out
    // should anything bring it back.
    globIgnores: ['**/node_modules/**/*', 'stats.json', 'og-image.png', 'screenshots/**', ...(hindi ? [] : ['**/noto-sans-devanagari*'])],
    // The lazy tier (pack-manifest.json) is known only once the bundle is written: vite.config.ts adds
    // its files to globIgnores then, and this drops any that still slip in. They load on first use.
    manifestTransforms: [async (entries) => ({ manifest: entries.filter((e) => !lazy.has(`/${e.url.replace(/^\//, '')}`)), warnings: [] })],
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/stats.json',
        handler: 'NetworkFirst',
        options: { cacheName: 'stats', networkTimeoutSeconds: 5, expiration: { maxEntries: 1 } },
      },
      {
        // Hashed build files only (name-<8 characters>.ext): what is not precached is kept here when first used.
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/[^/]+-[\w-]{8}\.\w+$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: LAZY_CACHE,
          expiration: { maxEntries: 40, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true },
        },
      },
    ],
    // A tripwire: a file this big belongs in the lazy tier, not in every install.
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
