import { defineConfig } from 'vitest/config'

// A busy machine (parallel workspaces, a CI runner) can take a few times longer than a quiet one:
// a test that needs 2 s alone must not fail at vitest's 5 s default (R68). The slow suites also run
// fewer, fixed cases unless FULL=1 (test/fixtures.ts).
export default defineConfig({
  test: { testTimeout: 20_000 },
})
