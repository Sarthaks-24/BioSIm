# Architecture

```
content/foods/*.json ──► packages/engine ──► apps/web (React PWA)
   cited inputs           pure TS model       ├─ 3D body  (three.js, organs built in code)
                          + golden tests      ├─ flat 2D fallback (Canvas, same curves)
                                              ├─ charts, step-by-step text view
                                              └─ lib/api.ts ──► apps/api (Hono + libSQL)
                                                                 "report a mistake" only
```

## Rules that keep it maintainable

1. **The engine has no UI dependencies.** It takes a meal and returns per-minute arrays,
   events and a particle schedule. If a number is wrong, the bug is in `packages/engine`, and
   a test there should catch it. Files: `stomach.ts` (emptying) → `transit.ts` (intestines and
   absorption) → `glucose.ts` → `events.ts` (key moments) and `particles.ts`, run by
   `simulate.ts`. Shared helpers (`stomachFraction`, `mealLocation`, `stageWindow`) live there
   too, so every chart computes the same thing the same way. Modules take their numbers as an
   argument (`params`, from the run's context); only `simulate.ts` hands them `PARAMS`, the
   human set. The run carries its own clock (`run.horizonMin`, `run.stepMin`, `run.length`), and
   `simulate({ organism?, items, profile? }, { lookup })` is the organism-ready way in
   (`simulate(meal)` still works). `test/plumbing.test.ts` guards this.
2. **One source for anatomy.** `apps/web/src/anatomy/human.ts` defines the curves. The 3D
   models (`three/geometry.ts`), the flat fallback and the particle paths all read them, so food
   always travels inside the organs it is drawn in.
3. **The URL is the saved state.** `?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120&lang=hi`.
   `engine/share.ts` encodes it and keeps the model version, so old links open with a note.
   `hooks/useUrlSync.ts` is the only code that reads or writes it, always through the router.
   The format is a contract with every link already shared: only add optional parameters.
   v2 adds `o` (organism: absent means human, forever, and `o=human` is never written; an
   unknown `o` opens human and is reported as `unknownOrganism`), `who` (profile), `layer` and
   `in` (inside view); `bo` is reserved. `apps/web/src/lib/v1-links.fixture.ts` lists every v1
   link, and `lib/links.test.ts` checks that each still opens the same meals.
4. **Signal IDs are a contract.** Every number the app draws, prints, reads aloud or puts in a
   link has one ID in `packages/engine/src/core/catalog.ts` (the glossary, frozen 2026-10-12),
   such as `blood.glucose` or `gut.stomach.contentG`. Share links, i18n keys (`signals.<id>.*`),
   golden tests and teachers' worksheets depend on them, so an ID is never renamed or deleted;
   new ones are only added, in the catalog first. IDs are organism-neutral (no `human.` prefix).
   Derived views such as "% of meal" or "rise above fasting" are helpers, not IDs. Each ID cites
   its sources from `core/sources.ts`. `test/catalog.test.ts` pins the frozen list and its shape,
   and `test/retired-names.test.ts` fails if an old name comes back.
5. **The API is optional.** It only receives error reports. The web app talks to it only
   through `apps/web/src/lib/api.ts`, and only when `VITE_API_URL` is set. Without it (production),
   the report opens as a pre-filled GitHub issue; with it, a failed POST offers the same issue.
6. **No personal data.** There are no accounts, no emails and no IP addresses stored. The rate
   limiter uses the connection address in memory only.

## Web app layout

| Folder | Contents |
|---|---|
| `pages/` | One page per route: home, simulator, teach, science, error and 404 |
| `components/` | UI pieces: meal picker, verdict line, timeline, stage panel, charts, lesson view, share, feedback |
| `components/kit/`, `components/stage/` | v2: the flat component kit, and the zones of the one-screen stage at `/next` (`pages/Stage.tsx`): meal bar, food sheet, keep button and kept tag, body pane, layer bar, graph column, notes, dock slider |
| `anatomy/` | One file per organism (`human.ts`): the gut curves, torso and arm outline, stomach stretch and particle positions shared by 3D and flat views; `bodyState.ts` (what the picture shows at a time, read from the signals the registry's `drives` name), `callouts.ts` + `CalloutOverlay.tsx` (organ labels with leaders that never overlap), `tones.ts` (organ colours) |
| `registry/` | Organisms, systems and organs as data (`human/`), checked by `registry.test.ts`. A new system is one entry plus a flat and a 3D layer |
| `three/` | WebGL scene and organ models (lazy-loaded): `geometry.ts` (one merged digestion mesh), `materials.ts` (opaque lit organs, fresnel rim, ink outline, rim-only skin), `quality.ts` (pixel-ratio cap) |
| `flat/` | Canvas fallback, also used if WebGL fails or its context is lost |
| `state/sim.ts` | Zustand store: meals, time, play, pace; `presentMeals`, `mealLabel` helpers |
| `state/clock.ts`, `state/motion.ts` | v2 (`/next`): the meal clock (`useClock`, read per frame without re-rendering; `useMealClock` runs playback) and the one reduced-motion flag (`useMotion`) |
| `hooks/` | `useSimulation` (memoised engine run), `useClock` (one clock, steady pace along the bar), `useUrlSync`; v2: `useRun`, `useLinkSync`, `useBodyClock` (which clock the shared bodies follow) |
| `lib/` | Time scale and formatting, colours (tested against `styles.css`), API client, presets, WebGL checks |
| `data/` | Loads the food files at build time (a quick field check in the browser; the full schema runs in CI and `foods.test.ts`) |
| `i18n/` | `en.json`, `hi.json` — a test fails if keys differ, or if a key is unused or missing (including the keys built from the catalog and the registry). English is bundled; Hindi is fetched when first needed |

## Performance

- The canvas renders on demand. A paused simulation draws nothing.
- The lit organs are opaque and write depth (no sorting, little overdraw), and the whole
  digestion layer is one mesh: one draw for the organs, one for their outline. Particles are
  instanced with their edge in the same shader: one draw call per nutrient. About 10 draws in all.
- The device pixel ratio is capped at 1.5 (1.25 and no MSAA when `deviceMemory ≤ 2`); no
  environment map. `?debug=fps` shows fps, draws, draw calls and triangles (docs/PHONE-CHECK.md).
- The flat body draws the organs once per active-organ change on one canvas and only the
  stomach and food per frame, on a second canvas the size of the gut.
- The 3D chunk loads only on the simulator page. The PWA precaches everything for offline use.
- The anatomy curves, the flat body and the organ labels use no three.js: `anatomy/spline.ts`
  does three's Catmull-Rom sums in the same order (a test checks them bit for bit), so all of
  three.js stays in the lazy 3D chunk, which only a device with WebGL downloads. three.js is
  bundled from its source modules (`vite.config.ts`), so that chunk takes only what it uses.
  `npm run budget -w @lifepeek/web` checks the route sizes after a build.
