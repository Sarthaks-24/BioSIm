import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import i18nSections from './scripts/i18n-sections.mjs'

/**
 * Hindi is in this build (R47: paused unless VITE_HINDI=1), read as import.meta.env reads it. Without
 * it the app never loads Hindi's font (i18n/index.ts), and its files are kept out of the precache too.
 */
const HINDI = loadEnv('production', process.cwd(), 'VITE_').VITE_HINDI === '1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // English page texts load with their pages, not with every page (scripts/i18n-sections.mjs).
    i18nSections(),
    VitePWA({
      // No forced reloads: a new version takes over the next time the app is opened, never in the
      // middle of a lesson (autoUpdate reloaded the page on first visit and wiped what was typed).
      registerType: 'prompt',
      // Registered by components/UpdateToast.tsx after the page has loaded, which also offers the
      // reload when a new version is waiting (council round 3): no extra script in index.html.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
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
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
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
          ...(HINDI ? [] : ['**/noto-sans-devanagari*']),
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/stats.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'stats', networkTimeoutSeconds: 5, expiration: { maxEntries: 1 } },
          },
        ],
        // The 3D chunk is large; still cache it so the app works offline in class.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
