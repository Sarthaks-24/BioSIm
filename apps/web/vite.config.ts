import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        // The 3D chunk is large; still cache it so the app works offline in class.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Plain files that must reach the server, not the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/THIRD_PARTY_NOTICES\.txt$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
      },
    }),
  ],
  resolve: {
    // three.js from its source modules instead of its one-file build. Then the bundler can split it
    // per module: the flat body's few maths classes (Vector3, the anatomy curves) ride with the
    // page, and the rest (renderer, materials, @react-three) stays in the lazy 3D chunk that only
    // a device with WebGL downloads. With the one-file build, any import of `three` pulled all
    // of it, and a manual `three` chunk also swallowed React, so every page loaded three.js.
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
