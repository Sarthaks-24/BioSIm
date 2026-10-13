# Architecture

```
content/foods/*.json ──► packages/engine ──► apps/web (React PWA)
   cited inputs           pure TS model       ├─ 3D body  (three.js, organs built in code)
                          + golden tests      ├─ flat 2D fallback (Canvas, same curves)
                                              ├─ graphs, Now line, tables
                                              └─ lib/api.ts ──► apps/api (Hono + libSQL)
                                                                 "report a mistake" only
```

## Rules that keep it maintainable

1. **The engine has no UI dependencies.** It takes a meal and returns per-minute arrays,
   events and a particle schedule. If a number is wrong, the bug is in `packages/engine`, and
   a test there should catch it. The model is a fixed, ordered list of modules
   (`src/modules/`: `gut` → `energy` → `bloodSugar`, in the frozen order of
   `core/module.ts`), each run once over the whole 48 h array. A module declares what it reads
   (`needs`) and writes (`provides`, internal `x.*` arrays, `moments`, `rhythms`); `ctx.put`
   throws on anything else, `ctx.get` too in development and tests (a production build drops
   that check), and `PROVIDES` is derived from the modules (`test/modules/`). The maths stays in
   `stomach.ts` (emptying), `transit.ts` (intestines and absorption), `glucose.ts` and
   `energy/energyBalance.ts`; `simulate.ts` runs the modules, then `events.ts` (key moments) and
   `particles.ts`, and returns a `RunResult` (`result.ts`): the signal table plus the meal,
   events and particles. Modules and helpers take their numbers as an argument (`params`, from
   the run's context, never a default); only `simulate.ts` hands them `PARAMS`, the human set.
   The run carries its own clock (`run.horizonMin`, `run.stepMin`, `run.length`), and
   `simulate({ organism?, items, profile? }, { lookup })` (a `RunInput`) is the way in
   (`simulate(meal)` still works). `test/plumbing.test.ts` guards this.
   **Two entries (E-2).** `@lifepeek/engine` is what the screen needs without running: types,
   the link codec, the lean catalog, `valueAt` and the view helpers (`view.ts`: `indexAt`,
   `stomachFraction`, `mealLocation`, `gutIsDone`, `activeStage`, which read the signal table,
   so every graph computes the same thing the same way). `@lifepeek/engine/run` (`run.ts`) is
   the engine itself: the web loads it with a plain `import()` when `/sim` mounts
   (`hooks/useRun.ts`), and `check-budget.mjs` fails if it ever lands in `/sim`'s first download.
2. **One source for anatomy.** `apps/web/src/anatomy/human.ts` defines the curves. The 3D
   models (`three/geometry.ts`), the flat fallback and the particle paths all read them, so food
   always travels inside the organs it is drawn in.
3. **The URL is the saved state.** `?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120&lang=hi`.
   `engine/share.ts` encodes it and keeps the model version, so old links open with a note.
   `hooks/useLinkSync.ts` reads and writes it on the stage (`/sim`), always through the router
   (`/next`, the stage's address while it was built, redirects there with the same query). No
   other code writes it (only `BodyView` reads the `?debug=fps` flag).
   The format is a contract with every link already shared: only add optional parameters.
   v2 adds `o` (organism: absent means human, forever, and `o=human` is never written; an
   unknown `o` opens human and is reported as `unknownOrganism`), `who` (profile), `layer` and
   `in` (inside view); `bo` is reserved. `apps/web/src/lib/v1-links.fixture.ts` lists every v1
   link, and `lib/links.test.ts` checks that each still opens the same meals.
4. **Signal IDs are a contract.** Every number the app draws, prints, reads aloud or puts in a
   link has one ID in `packages/engine/src/core/catalog.ts` (the glossary, frozen 2026-10-12;
   reserved rows and each row's definition and retired names are in `core/catalog-docs.ts`),
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
| `pages/` | One page per route: home, the stage (`/sim`, `Simulator.tsx`; `/next` redirects to it), teach, science, about, privacy, stats (`/stats`), and the error and 404 pages (`Misc.tsx`). Home and `Misc.tsx` are in the main bundle; the rest load lazily |
| `components/` | Shared pieces: the site layout, the body (`BodyView`: 3D or flat), the nutrient shapes, the report form, the medical note, load boundaries |
| `components/graphs/` | v2 graph column: `StripStack` (the stacked graphs on one time axis; tabs on a phone), `SignalStrip` (one signal: line, band, kept-run ghost, marked moments), `Playhead` (the "now" line and readouts, moved straight from the clock store), `marks.ts` (which moments a graph marks), `labels.ts` (where words on a plot go: off the lines and other labels, inside the plot), `HowWeKnow` (just the ⓘ button; its popover `HowWeKnowPanel` and the source list are a lazy chunk loaded on first hover, focus or press, with an error boundary and "Try again" if the chunk fails to load, `components/LoadBoundary.tsx`), `layout.ts` |
| `components/kit/`, `components/stage/` | v2: the flat component kit, and the zones of the one-screen stage at `/sim` (`pages/Simulator.tsx`): meal bar, food sheet, keep button and kept tag, body pane with the Now line (where the meal is, from the model: `lib/nowWhere.ts`; its "More" text is a lazy chunk) and summary sentence (`lib/summary.ts`), layer bar, graph column, notes, dock timeline with key-moment markers (`Timeline`, `lib/moments.ts`) |
| `anatomy/` | One file per organism (`human.ts`): the gut curves, torso and arm outline, stomach stretch and particle positions shared by 3D and flat views; `bodyState.ts` (what the picture shows at a time, read from the signals the registry's `drives` name), `callouts.ts` + `CalloutOverlay.tsx` (organ labels with leaders that never overlap), `tones.ts` (organ colours) |
| `registry/` | Organisms, systems and organs as data (`human/`), checked by `registry.test.ts`. A new system is one entry plus a flat and a 3D layer. `human/organism.ts` also overrides two graph scales (docs/MODEL.md, Graph scales); `units.ts` (unit words), `i18nKeys.ts` (the i18n keys built from the catalog and the registry) |
| `three/` | WebGL scene and organ models (lazy-loaded): `geometry.ts` (one merged digestion mesh), `materials.ts` (opaque lit organs, fresnel rim, ink outline, rim-only skin), `quality.ts` (pixel-ratio cap) |
| `flat/` | Canvas fallback, also used if WebGL fails or its context is lost |
| `state/run.ts` | The run state, one meal and an optional kept run, stored as inputs (`hooks/useRun.ts` recomputes each run) |
| `state/clock.ts`, `state/motion.ts`, `state/stripTab.ts` | The meal clock (`useClock`, read per frame without re-rendering; `useMealClock` runs playback), the one reduced-motion flag (`useMotion`) and the graph tab shown when graphs are tabbed (`useStripTab`, so keys can switch it too) |
| `hooks/` | `useRun` (the memoised engine run), `useLinkSync`, `useBodyClock` (which clock the shared bodies follow), `useProjector` (projector mode, for what CSS can't reach: the bodies' drawing, the graph tabs) |
| `lib/` | Time scale and formatting, colours (tested against `styles.css`), API client, presets, WebGL checks |
| `lib/axis.ts`, `lib/formatSignal.ts` | v2 graphs: the shared x scale (same as the dock's thumb) and each signal's fixed y range, stretched once if a value falls outside; numbers rounded to the signal's display step, in Latin digits, with the unit from i18n |
| `data/` | Loads the food files at build time (a quick field check in the browser; the full schema runs in CI and `foods.test.ts`) |
| `i18n/` | `en.json`, `hi.json` — a test fails if keys differ, or if a key is unused or missing (including the keys built from the catalog and the registry). English is bundled, except the texts of the pages that bring their own (privacy, about, teach, science, stats, the report form: `scripts/i18n-sections.mjs`, `addEnglish`); Hindi is fetched when first needed. `REVIEW.md` lists every Hindi string with its reviewer status, kept in step with the JSON by `scripts/hi-review.mjs --write` (which also exports `hi-review.csv`; `i18n.test.ts` fails when it is out of date). `pseudo.ts`: the +40 % pseudo-locale for the layout tests, only in builds with `VITE_PSEUDO=1` |

## Performance

- The canvas renders on demand. A paused simulation draws nothing.
- The lit organs are opaque and write depth (no sorting, little overdraw), and the whole
  digestion layer is one mesh: one draw for the organs, one for their outline. Particles are
  instanced with their edge in the same shader: one draw call per nutrient. About 10 draws in all.
- The device pixel ratio is capped at 1.5 (1.25 and no MSAA when `deviceMemory ≤ 2`); no
  environment map. `?debug=fps` shows fps, draws, draw calls and triangles (docs/PHONE-CHECK.md).
- The flat body draws the organs once per active-organ change on one canvas and only the
  stomach and food per frame, on a second canvas the size of the gut.
- The 3D chunk loads only on the simulator pages (`/sim`, through `BodyView`). The PWA
  precaches everything for offline use.
- The anatomy curves, the flat body and the organ labels use no three.js: `anatomy/spline.ts`
  does three's Catmull-Rom sums in the same order (a test checks them bit for bit), so all of
  three.js stays in the lazy 3D chunk, which only a device with WebGL downloads. three.js is
  bundled from its source modules (`vite.config.ts`), so that chunk takes only what it uses.
  `npm run budget -w @lifepeek/web` checks the route sizes after a build.
