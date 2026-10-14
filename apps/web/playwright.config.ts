import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

// Set PLAYWRIGHT_BASE_URL to run the gate against a deployed site (WP-22) or a server you started;
// otherwise the tests build the app and serve the preview locally. That build has the +40 %
// pseudo-locale (VITE_PSEUDO=1) and Hindi (VITE_HINDI=1, paused in real builds, R47), so it goes to its own folder (dist-e2e) and port: `dist` stays the
// real build that `npm run budget` measures, and a plain `npm run preview` on 4173 is never
// mistaken for the test build.
// E2E_PORT picks another port, so two checkouts (worktrees) can run their tests at once.
const E2E_PORT = Number(process.env.E2E_PORT ?? 4174)
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
      'update.spec.ts',
      'loading.spec.ts',
      'links.spec.ts',
      'overlays.spec.ts',
      'web-basics.spec.ts',
      'activity.spec.ts',
      'screen-reader.spec.ts',
      'lymph.spec.ts',
      'breathing.spec.ts',
      'circulation.spec.ts',
      'effort.spec.ts',
      'count.spec.ts',
      'kidneys.spec.ts',
      'flagship.spec.ts',
      'worksheet.spec.ts',
      'why.spec.ts',
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
      'overlays.spec.ts',
      'breathing.spec.ts',
      'circulation.spec.ts',
      'effort.spec.ts',
      'count.spec.ts',
      'kidneys.spec.ts',
      'flagship.spec.ts',
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
    testMatch: [
      'gate.spec.ts',
      'hindi.spec.ts',
      'stage.spec.ts',
      'now.spec.ts',
      'projector.spec.ts',
      'keyboard.spec.ts',
      'a11y.spec.ts',
      'links.spec.ts',
      'overlays.spec.ts',
      'activity.spec.ts',
      'lymph.spec.ts',
      'breathing.spec.ts',
      'circulation.spec.ts',
      'effort.spec.ts',
      'count.spec.ts',
      'kidneys.spec.ts',
      'flagship.spec.ts',
      'why.spec.ts',
    ],
    use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, launchOptions: webgl },
  },
  {
    name: 'reduced',
    testMatch: [
      'motion.spec.ts',
      'stage.spec.ts',
      'breathing.spec.ts',
      'circulation.spec.ts',
      'effort.spec.ts',
      'count.spec.ts',
      'kidneys.spec.ts',
    ],
    use: { viewport: desktop, reducedMotion: 'reduce', launchOptions: webgl },
  },
  {
    name: 'nowebgl',
    // circulation.spec.ts, kidneys.spec.ts: Heart & blood, Kidneys & water drawn flat (with WebGL they are drawn in 3D since A-5, A-6).
    testMatch: ['stage.spec.ts', 'overlays.spec.ts', 'effort.spec.ts', 'circulation.spec.ts', 'kidneys.spec.ts'],
    use: { viewport: desktop, launchOptions: noWebgl },
  },
  ...trackA(),
  {
    // The fps check, with the nowebgl setup (flat body). It waits for every other project so no
    // other test competes for the CPU while it counts frames.
    name: 'perf',
    testMatch: ['perf.spec.ts'],
    dependencies: ['desktop', 'projector', 'phone', 'reduced', 'nowebgl', ...trackA().map((p) => p.name!)],
    use: { viewport: desktop, launchOptions: noWebgl },
  },
  // A 40-minute lesson on one page, for leaks (T7, report): nightly only, it takes the whole run.
  ...(process.env.E2E_NIGHTLY
    ? [{ name: 'lesson', testMatch: ['lesson.spec.ts'], timeout: 60 * 60_000, use: { viewport: desktop, launchOptions: webgl } }]
    : []),
]

/**
 * Track A projects (T0; plan qa-fixes §3.1). They report until the T-step that fixes their bugs
 * flips them (e2e/invariants.spec.ts INVARIANTS, e2e/helpers/gate.ts RED_LIST). WebKit and Firefox
 * run only with E2E_ENGINES=1 (main and nightly CI); the visual shots only with E2E_VISUAL=1
 * (their Linux baselines come from the visual-baselines workflow, §3.3).
 */
function trackA(): NonNullable<PlaywrightTestConfig['projects']> {
  const phoneAt = (width: number, height: number) => ({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    launchOptions: webgl,
  })
  // The overlay checks (FP-5) run on every one of these projects too.
  const invariants = ['invariants.spec.ts', 'overlays.spec.ts']
  return [
    // One report test per QA-sweep bug seen failing on eee16c9 (e2e/red-list.md); each sets its own window.
    { name: 'redlist', testMatch: ['redlist.spec.ts'], use: { viewport: desktop, launchOptions: webgl } },
    { name: 'phone-small', testMatch: invariants, use: phoneAt(360, 640) },
    // A 360×640 phone with its browser bars showing.
    { name: 'phone-560', testMatch: invariants, use: phoneAt(360, 560) },
    { name: 'phone-xs', testMatch: invariants, use: phoneAt(320, 568) },
    { name: 'tablet-portrait', testMatch: invariants, use: phoneAt(768, 1024) },
    // Phone landscape and a 1280-wide laptop at 200 % zoom; the spec also checks 740×360, 844×390, 640×400.
    { name: 'landscape', testMatch: invariants, use: phoneAt(640, 360) },
    // Projector mode at 1024×768; the spec also checks 1280×800 and 1366×768.
    { name: 'projector-sizes', testMatch: invariants, use: { viewport: { width: 1024, height: 768 }, launchOptions: webgl } },
    // Site data and the service worker blocked (a school-managed browser); desktop and phone sizes.
    { name: 'storage-blocked', testMatch: invariants, use: { viewport: desktop, serviceWorkers: 'block', launchOptions: webgl } },
    ...(process.env.E2E_ENGINES
      ? [
          {
            name: 'webkit-desktop',
            testMatch: [...invariants, 'smoke.spec.ts', 'update.spec.ts', 'loading.spec.ts'],
            use: { ...devices['Desktop Safari'], viewport: desktop },
          },
          {
            name: 'webkit-phone',
            testMatch: [...invariants, 'smoke.spec.ts', 'loading.spec.ts', 'links.spec.ts'],
            use: { ...devices['iPhone 13'] },
          },
          {
            name: 'firefox-desktop',
            testMatch: [...invariants, 'smoke.spec.ts', 'update.spec.ts', 'loading.spec.ts'],
            // Firefox's NS_ERROR_FAILURE navigation flake (R59): the helpers try such a navigation
            // once more (e2e/helpers/gate.ts goto); a test that still fails gets one more run, as on CI.
            retries: 1,
            use: { ...devices['Desktop Firefox'], viewport: desktop },
          },
        ]
      : []),
    ...(process.env.E2E_VISUAL
      ? [
          {
            name: 'visual',
            testMatch: ['visual.spec.ts'],
            use: { viewport: desktop, launchOptions: noWebgl, reducedMotion: 'reduce' as const },
          },
          {
            name: 'visual-3d',
            testMatch: ['visual.spec.ts'],
            use: { viewport: desktop, launchOptions: webgl, reducedMotion: 'reduce' as const },
          },
        ]
      : []),
  ]
}

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
        // Hindi too: it is paused in real builds (R47, i18n/language.ts), but its tests keep running here.
        env: { VITE_PSEUDO: '1', VITE_HINDI: '1' },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
