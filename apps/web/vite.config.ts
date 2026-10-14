import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import i18nSections from './scripts/i18n-sections.mjs'
import prerenderHead from './scripts/prerender-head.mjs'
import cacheTiersPlugin, { LAZY_CACHE } from './scripts/cache-tiers.mjs'
import { siteUrl } from './scripts/site-url.mjs'
import qrCode from './scripts/qr-code.mjs'

/**
 * Hindi is in this build (R47: paused unless VITE_HINDI=1), read as import.meta.env reads it. Without
 * it the app never loads Hindi's font (i18n/index.ts), and its files are kept out of the precache too.
 */
const ENV = loadEnv('production', process.cwd(), 'VITE_')
const HINDI = ENV.VITE_HINDI === '1'

/** The production address, the one build constant (scripts/site-url.mjs): VITE_SITE_URL or the planned name. */
const SITE_URL = siteUrl(ENV.VITE_SITE_URL)

/** Which built files the service worker saves at install, and which on first use (T12d, R71). */
const tiers = cacheTiersPlugin()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // English page texts load with their pages, not with every page (scripts/i18n-sections.mjs).
    i18nSections(),
    // Each page's head in the built HTML, the 404 page, sitemap.xml and robots.txt (T12a).
    prerenderHead({ site: SITE_URL }),
    // Teach's QR code, a picture of this build's address (scripts/qr-code.mjs, R79).
    qrCode({ site: SITE_URL }),
    // dist/pack-manifest.json and the precache list: the core only (scripts/cache-tiers.mjs).
    tiers,
    VitePWA({
      // No forced reloads: a new version takes over the next time the app is opened, never in the
      // middle of a lesson (autoUpdate reloaded the page on first visit and wiped what was typed).
      registerType: 'prompt',
      // Registered by components/UpdateToast.tsx after the page has loaded, which also offers the
      // reload when a new version is waiting (council round 3): no extra script in index.html.
      injectRegister: false,
      // The icons and favicon are in the precache by globPatterns once each (these would add them twice).
      includeAssets: [],
      includeManifestIcons: false,
      manifest: {
        name: 'LifePeek — Digestion Simulator',
        short_name: 'LifePeek',
        description: 'LifePeek: peek inside living things. Watch a meal travel through the body, and compare it with another.',
        lang: 'en',
        categories: ['education'],
        theme_color: '#14213d',
        background_color: '#eef3f1',
        display: 'standalone',
        id: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Its mark inside the central safe zone, so a round or squircle mask never crops it (scripts/make-icons.mjs).
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // The install dialog's pictures of the stage (D-EXTRA, WP-19), made by scripts/make-share-images.mjs.
        screenshots: [
          {
            src: '/screenshots/wide.jpg',
            sizes: '1280x800',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Cola, with burger and fries kept, on a laptop',
          },
          { src: '/screenshots/narrow.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Cola on a phone' },
        ],
        shortcuts: [{ name: 'For teachers', short_name: 'Teach', url: '/teach', icons: [{ src: '/icon-192.png', sizes: '192x192' }] }],
      },
      workbox: {
        // Load on demand, small cache (R71): at install only the core (scripts/cache-tiers.mjs: the
        // shell, every page's code with the stage, the digestion model and the engine, the English
        // core text, the latin fonts, the icons, the resting body). The other hashed files (the 3D
        // body, the stage's on-use parts, the latin-ext fonts) are cached the first time they are
        // used (lp-lazy below), or ahead of class by Teach's "Save for class offline".
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        manifestTransforms: [tiers.manifestTransform],
        // stats.json changes every week without a new app version, so it is not precached: the
        // network first, and offline the last copy that was fetched (the /stats page).
        // The share image and the install screenshots are for other sites and the install dialog,
        // never drawn by the app offline: not precached (precache budget).
        // Without Hindi, Hindi's font (about 138 KB) is not even in the build; this keeps it out
        // should anything bring it back.
        globIgnores: [
          '**/node_modules/**/*',
          'stats.json',
          'og-image.png',
          'screenshots/**',
          // Over the size tripwire below, and lazy anyway: kept out here so the build doesn't warn.
          'assets/BodyCanvas-*',
          // The per-page HTML and the 404 page are for the server (scripts/prerender-head.mjs);
          // offline, the service worker serves index.html for every page.
          '*/index.html',
          '404.html',
          ...(HINDI ? [] : ['**/noto-sans-devanagari*']),
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/stats.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'stats', networkTimeoutSeconds: 5, expiration: { maxEntries: 1 } },
          },
          {
            // Lazy files, the first time they are used: hashed names under /assets/ only (a new
            // version has new names, so the cached copy is never stale), never a .woff fallback.
            // Not the share image, screenshots, robots, sitemap, notices or /api: they are not here.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css|woff2|svg|png)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: LAZY_CACHE,
              cacheableResponse: { statuses: [200] },
              // A module script asks with an Origin header and a server may answer "Vary: Origin"
              // (vite preview does): a copy saved by Teach's "Save for class offline" (no Origin)
              // must still match. Same-origin files with hashed names: one answer per name.
              matchOptions: { ignoreVary: true },
              // About 40 files: two versions of every lazy part; old versions age out.
              expiration: { maxEntries: 40, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true },
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
      },
    }),
  ],
  // src/lib/site.ts reads it; set here so it always has the one value (scripts/site-url.mjs).
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(SITE_URL) },
  resolve: {
    // three.js from its source modules instead of its one-file build, so the lazy 3D chunk (only
    // a device with WebGL downloads it) takes only the modules it uses. The pages import no
    // three.js at all: the anatomy curves have their own maths (anatomy/spline.ts). With the
    // one-file build, any import of `three` pulled all of it, and a manual `three` chunk also
    // swallowed React, so every page loaded three.js.
    alias: [{ find: /^three$/, replacement: 'three/src/Three.js' }],
  },
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    // Vite warns about any chunk over 500 kB (minified, not gzipped). The one over it is the lazy 3D
    // body (three.js and @react-three, about 970 kB, 260 kB gzipped), downloaded only by a device
    // with WebGL after the stage has drawn; its gzipped size has its own budget in
    // scripts/check-budget.mjs (270 KB). So the warning is set just above it: a new big chunk still warns.
    chunkSizeWarningLimit: 1000,
    // For scripts/check-budget.mjs (route sizes). Under dist/.vite/, which the service worker does not precache.
    manifest: true,
    // A lazy chunk's preload list named the entry chunk (index-*.js) too. The page loaded it with a
    // <script>, not a <link>, so the preload helper added a modulepreload for it that nothing used:
    // a WebKit console warning on every /sim load (B19). The entry is always loaded already.
    modulePreload: { resolveDependencies: (_file, deps) => deps.filter((dep) => !/^assets\/index-[\w-]+\.js$/.test(dep)) },
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Vite's lazy-import helper rode in the i18n chunk while i18n/index.ts lazily imported
          // hi.json. With Hindi paused (R47) that import is gone from real builds, and the helper
          // became a chunk of its own: one more file, +0.24 KB gzipped on every page. This keeps
          // it with i18n: the same modules as before, and only these (not their dependencies).
          groups: [
            {
              name: 'i18n',
              test: /vite[\\/]preload-helper|[\\/]i18next[\\/]dist[\\/]|react-i18next[\\/]dist[\\/]es[\\/]initReactI18next|lifepeek-en[\\/-]core|src[\\/]i18n[\\/](index|language)\.ts/,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
})
