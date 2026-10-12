# BioSim

Compare what happens to two meals inside your body. Pick a meal for A and a meal for B, then
watch them travel through a 3D body side by side. You can see how fast each leaves the stomach,
where the carbohydrate, protein, fat, fibre and water go, and how blood sugar typically
responds.

It is built for classrooms:

- a projector mode
- English and Hindi
- a text-only step-by-step view
- works offline once loaded
- every comparison has a link you can share

> This is an educational model of a typical healthy adult. It is not medical advice.

## Run it locally

```bash
npm install
npm run dev        # web app → http://localhost:5173
npm run dev:api    # optional API for "report a mistake" → http://localhost:8787
```

The web app works without the API: links carry the whole comparison, and error reports fall back to a GitHub issue.

```bash
npm run check      # validate foods, typecheck, unit tests, production build
npm run e2e -w @lifepeek/web   # browser smoke tests (needs: npx playwright install chromium)
```

## What's where

| Path | What it is |
|---|---|
| `packages/engine` | The model, in pure TypeScript: food schema, stomach emptying, gut transit and the blood-sugar band. Golden tests check it against published physiology. |
| `content/foods` | One JSON file per food. Each holds only cited inputs: nutrients, glycemic index and sources. |
| `apps/web` | The React + three.js app (PWA). Organs are modelled in code from shared anatomy curves. If WebGL is not available, a flat 2D diagram is shown instead. |
| `apps/api` | Hono + SQLite/libSQL. Receives "report a mistake" messages. No accounts, no personal data. |
| `docs/` | How the model works (with references), the architecture and the decisions behind it. |

## Add a food

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

1. Copy a file in `content/foods/`.
2. Fill in the nutrients and glycemic index, citing a source for each.
3. Run `npm run validate`.

The validator rejects numbers that don't add up.

## Deploy

- **Web:** any static host. `npm run build -w @lifepeek/web` writes `apps/web/dist`. Rewrite all paths to `index.html` (`vercel.json` is included). Set `VITE_API_URL` if the API is on another origin.
- **API:** any Node 20+ host. Run `npm start -w @lifepeek/api` with these settings (see `apps/api/.env.example`):
  - `DATABASE_URL`: a Turso/libSQL URL, or `file:lifepeek.db`
  - `DATABASE_AUTH_TOKEN`: the database token
  - `ALLOWED_ORIGINS`: the origins allowed to call the API
  - `ADMIN_TOKEN`: the token for reading error reports
  - `TRUST_PROXY=1`: only behind a proxy you control that sets `X-Forwarded-For`
