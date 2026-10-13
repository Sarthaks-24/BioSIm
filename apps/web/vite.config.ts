import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import i18nSections from './scripts/i18n-sections.mjs'

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
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'LifePeek — Digestion Simulator',
        short_name: 'LifePeek',
        description: 'LifePeek: peek inside living things. Compare what happens to two meals inside your body.',
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
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // stats.json changes every week without a new app version, so it is not precached: the
        // network first, and offline the last copy that was fetched (the /stats page).
        globIgnores: ['**/node_modules/**/*', 'stats.json'],
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
        navigateFallbackDenylist: [/^\/api\//, /^\/THIRD_PARTY_NOTICES\.txt$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/stats\.json$/],
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
  },
})
