import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'

// Set PLAYWRIGHT_BASE_URL to run the gate against a deployed site (WP-22) or a server you started;
// otherwise the tests build the app and serve the preview locally. That build has the +40 %
// pseudo-locale (VITE_PSEUDO=1), so it goes to its own folder (dist-e2e) and port: `dist` stays the
// real build that `npm run budget` measures, and a plain `npm run preview` on 4173 is never
// mistaken for the test build.
const E2E_PORT = 4174
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${E2E_PORT}`

// Software WebGL (SwiftShader), so the 3D body draws on CI machines without a GPU.
const webgl = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
// No WebGL at all: the app must fall back to the flat diagram.
const noWebgl = { args: ['--disable-3d-apis'] }

const desktop = { width: 1440, height: 900 }

// Projects of the release gate. Which page each check runs on, and whether it only reports or
// enforces, is in e2e/helpers/gate.ts (GATE_ROUTES).
const projects: PlaywrightTestConfig['projects'] = [
  {
    name: 'desktop',
    testMatch: [
      'smoke.spec.ts',
      'gate.spec.ts',
      'hindi.spec.ts',
      'a11y.spec.ts',
      'offline.spec.ts',
      'stage.spec.ts',
      'graphs.spec.ts',
      'stats.spec.ts',
      'now.spec.ts',
      'keyboard.spec.ts',
      'teach.spec.ts',
    ],
    use: { viewport: desktop, launchOptions: webgl },
  },
  {
    name: 'projector',
    testMatch: [
      'gate.spec.ts',
      'hindi.spec.ts',
      'stage.spec.ts',
      'graphs.spec.ts',
      'now.spec.ts',
      'projector.spec.ts',
      'keyboard.spec.ts',
      'a11y.spec.ts',
      'teach.spec.ts',
    ],
    use: {
      viewport: { width: 1280, height: 800 },
      launchOptions: webgl,
      // Projector mode switched on, as a teacher would have it (the pref Layout reads at start).
      storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'lifepeek:projector', value: '1' }] }] },
    },
  },
  {
    name: 'phone',
    testMatch: ['gate.spec.ts', 'hindi.spec.ts', 'stage.spec.ts', 'now.spec.ts', 'projector.spec.ts', 'keyboard.spec.ts', 'a11y.spec.ts'],
    use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, launchOptions: webgl },
  },
  {
    name: 'reduced',
    testMatch: ['motion.spec.ts', 'stage.spec.ts'],
    use: { viewport: desktop, reducedMotion: 'reduce', launchOptions: webgl },
  },
  {
    name: 'nowebgl',
    testMatch: ['stage.spec.ts'],
    use: { viewport: desktop, launchOptions: noWebgl },
  },
  {
    // The fps check, with the nowebgl setup (flat body). It waits for every other project so no
    // other test competes for the CPU while it counts frames.
    name: 'perf',
    testMatch: ['perf.spec.ts'],
    dependencies: ['desktop', 'projector', 'phone', 'reduced', 'nowebgl'],
    use: { viewport: desktop, launchOptions: noWebgl },
  },
]

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Software WebGL is slow on a busy machine; a little more patience per assertion avoids flakes.
  expect: { timeout: 10_000 },
  // Each worker runs its own software-rendered browser. More than this starves the CPU and makes
  // the timing-sensitive tests flaky (CI runners have 4 cores).
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  // "list" also prints the [gate] lines that report-mode checks write.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL },
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build -- --outDir dist-e2e && npm run preview -- --outDir dist-e2e --port ${E2E_PORT} --strictPort`,
        url: `http://localhost:${E2E_PORT}`,
        // The +40 % pseudo-locale for hindi.spec.ts (i18n/pseudo.ts). Only this build has it; Vercel never sets it.
        env: { VITE_PSEUDO: '1' },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
