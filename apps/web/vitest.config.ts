import { defineConfig } from 'vitest/config'
import { siteUrl } from './scripts/site-url.mjs'

// Unit tests only; browser tests in e2e/ run with Playwright. Build scripts are plain Node (.mjs).
export default defineConfig({
  // As in vite.config.ts: the one site address (scripts/site-url.mjs).
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl(process.env.VITE_SITE_URL)) },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'] },
})
