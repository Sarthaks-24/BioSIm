import fs from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import i18nSections from './scripts/i18n-sections.mjs'
import prerenderHead from './scripts/prerender-head.mjs'
import cacheTiersPlugin from './scripts/cache-tiers.mjs'
import { workboxPolicy } from './scripts/cache-policy.mjs'
import { siteUrl } from './scripts/site-url.mjs'
import qrCode from './scripts/qr-code.mjs'
import vhFallback from './scripts/vh-fallback.mjs'

/**
 * Hindi is in this build (R47: paused unless VITE_HINDI=1), read as import.meta.env reads it. Without
 * it the app never loads Hindi's font (i18n/index.ts), and its files are kept out of the precache too.
 */
const ENV = loadEnv('production', process.cwd(), 'VITE_')
const HINDI = ENV.VITE_HINDI === '1'

/** The production address, the one build constant (scripts/site-url.mjs): VITE_SITE_URL or the planned name. */
const SITE_URL = siteUrl(ENV.VITE_SITE_URL)

/**
 * The headers the deployed site sends with every path (vercel.json, the "/(.*)" block): the
 * Content-Security-Policy and the rest. `vite preview` sends them too, so the e2e tests run under
 * the same policy as production (R120 #10).
 */
const VERCEL = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const SITE_HEADERS = Object.fromEntries(
  VERCEL.headers.filter((h) => h.source === '/(.*)').flatMap((h) => h.headers.map(({ key, value }) => [key, value])),
)

/** Which built files the service worker saves at install, and which on first use (R71, scripts/cache-tiers.mjs). */
const tiers = cacheTiersPlugin()
/** The caching policy (R71, scripts/cache-policy.mjs); its globIgnores get the lazy tier's files once the bundle is written. */
const WORKBOX = workboxPolicy({ hindi: HINDI, tiers })

export default defineConfig({
  plugins: [
    // The deployed site's headers, CSP included (vercel.json), on every preview response (the e2e
    // tests): first of the plugins, as `preview.headers` and prerender-head's own middleware (it
    // answers /sim, /teach… with their built HTML) would leave those pages without them.
    {
      name: 'lifepeek-site-headers',
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(SITE_HEADERS)) res.setHeader(key, value)
          next()
        })
      },
    },
    react(),
    tailwindcss(),
    // English page texts load with their pages, not with every page (scripts/i18n-sections.mjs).
    i18nSections(),
    // Each page's head in the built HTML, the 404 page, sitemap.xml and robots.txt (T12a).
    prerenderHead({ site: SITE_URL }),
    // Teach's QR code, a picture of this build's address (scripts/qr-code.mjs, R79).
    qrCode({ site: SITE_URL }),
    // A vh fallback before every dvh in the built CSS, which the CSS minifier would remove (R87).
    vhFallback(),
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
      // The caching policy (R71): scripts/cache-policy.mjs, with the tiers of scripts/cache-tiers.mjs.
      workbox: WORKBOX,
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
  // The engine worker (W-2, src/engine-worker.ts): one classic script, since old Android Chrome
  // has no module workers (architecture §3.2). Lazy, in lp-lazy (scripts/cache-tiers.mjs).
  worker: {
    format: 'iife',
    rolldownOptions: { output: { entryFileNames: 'assets/[name]-[hash].js' } },
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
    // A system's 3D layer (three/layers/<id>.ts, A-3 on) is imported by its registry row in /sim, but
    // only ever loaded by the 3D body, after the system's pack: everything it imports is loaded by
    // then. Its preload list would be /sim bytes for nothing (16 file names: +0.2 KB gz, measured), so
    // it has none.
    modulePreload: {
      resolveDependencies: (file, deps) =>
        /^assets\/layer3d-/.test(file) ? [] : deps.filter((dep) => !/^assets\/index-[\w-]+\.js$/.test(dep)),
    },
    rolldownOptions: {
      output: {
        // A 3D layer's chunk is named so (`layer3d-<system>`): the preload rule above finds it by name.
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId && /[\/]src[\/]three[\/]layers[\/]/.test(chunk.facadeModuleId)
            ? 'assets/layer3d-[name]-[hash].js'
            : 'assets/[name]-[hash].js',
        codeSplitting: {
          // Vite's lazy-import helper rode in the i18n chunk while i18n/index.ts lazily imported
          // hi.json. With Hindi paused (R47) that import is gone from real builds, and the helper
          // became a chunk of its own: one more file, +0.24 KB gzipped on every page. This keeps
          // it with i18n: the same modules as before, and only these (not their dependencies).
          groups: [
            {
              name: 'i18n',
              test: /vite[\\/]preload-helper|[\\/]i18next[\\/]dist[\\/]|react-i18next[\\/]dist[\\/]es[\\/]initReactI18next|lifepeek-en[\\/-]core|src[\\/]i18n[\\/](index|language|text)\.ts/,
              includeDependenciesRecursively: false,
            },
            // U-2: the meal clock and the systems registry, one chunk of the stage's (as before U-2).
            // U-1: the effort pack's rows (muscles/row.ts) join it the same way.
            // The breathing pack and the picker read the clock; left to itself the bundler then cut
            // the registry into a chunk of its own (+0.18 KB gz on /sim, measured). Only these modules.
            // U-4: the kidneys row too (alone it was a 0.2 KB chunk of its own on /sim, measured).
            // U-7: the nerves row too (the same 0.2 KB chunk of its own, measured).
            // U-6: the hormones row the same (its own 0.2 KB chunk on /sim otherwise, measured).
            // R-1: the reproduction row too (its own 0.21 KB chunk on /sim otherwise, measured).
            {
              name: 'clock',
              test: /src[\\/](state[\\/]clock|lib[\\/]time|systems[\\/](registry|digestion[\\/]def|breathing[\\/]row|circulation[\\/]row|kidneys[\\/]row|lymph[\\/]def|muscles[\\/]row|nerves[\\/]row|hormones[\\/]row|reproduction[\\/]row))\.ts$|engine[\\/]src[\\/]core[\\/]signal\.ts$|zustand[\\/]esm[\\/]middleware/,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
})
