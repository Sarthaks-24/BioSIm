import { defineConfig } from 'vitest/config'

// Unit tests only; browser tests in e2e/ run with Playwright. Build scripts are plain Node (.mjs).
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'] },
})
