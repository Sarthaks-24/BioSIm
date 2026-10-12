# Architecture

```
content/foods/*.json ──► packages/engine ──► apps/web (React PWA)
   cited inputs           pure TS model       ├─ 3D body  (three.js, organs built in code)
                          + golden tests      ├─ flat 2D fallback (Canvas, same curves)
                                              ├─ charts, step-by-step text view
                                              └─ lib/api.ts ──► apps/api (Hono + libSQL)
                                                                 short links, error reports
```

## Rules that keep it maintainable

1. **The engine has no UI dependencies.** It takes a meal and returns per-minute arrays,
   events and a particle schedule. If a number is wrong, the bug is in `packages/engine`, and
   a test there should catch it.
2. **One source for anatomy.** `apps/web/src/anatomy/anatomy.ts` defines the curves. The 3D
   models (`three/geometry.ts`), the flat fallback and the particle paths all read them, so food
   always travels inside the organs it is drawn in.
3. **The URL is the saved state.** `?v=1&a=cola:1&b=cheeseburger:1,fries:1&t=120`.
   `engine/share.ts` encodes it and checks its version. A short link is only a code that points
   to that query.
4. **The API is optional.** The web app talks to it only through `apps/web/src/lib/api.ts`, and
   every call there fails soft.
5. **No personal data.** There are no accounts. In error reports the email is optional and
   used only to reply.

## Web app layout

| Folder | Contents |
|---|---|
| `pages/` | One page per route: home, simulator, teach, science, short link, 404 |
| `components/` | UI pieces: meal picker, timeline, stage panel, charts, lesson view, share, feedback |
| `three/` | WebGL scene (lazy-loaded) |
| `flat/` | Canvas fallback |
| `state/sim.ts` | Zustand store holding meals, time, play and speed |
| `hooks/` | `useSimulation` (memoised engine run), `useClock` (one clock for both meals) |
| `i18n/` | `en.json`, `hi.json` (same keys; `hi` checked against `en`) |

## Performance

- The canvas renders on demand. A paused simulation draws nothing.
- Both bodies share one set of geometry, and particles are instanced: one draw call per
  nutrient.
- The 3D chunk loads only on the simulator page. The PWA precaches everything for offline use.
