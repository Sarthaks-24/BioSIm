# LifePeek

**LifePeek: peek inside living things.** · LifePeek: सजीवों के अंदर झाँकिए

[![Live app](https://img.shields.io/badge/live-lifepeek.vercel.app-14213d)](https://lifepeek.vercel.app)
[![Code: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT.md)
[![CI](https://github.com/Sarthaks-24/lifepeek/actions/workflows/ci.yml/badge.svg)](https://github.com/Sarthaks-24/lifepeek/actions/workflows/ci.yml)

**Try it: <https://lifepeek.vercel.app>** (free, no login, works offline once loaded)

*LifePeek was called BioSim until 2026.*

See what happens to a meal inside a typical healthy body (a model, not yours). Pick a meal, press
Play and watch it travel through a 3D body, with graphs of the stomach, blood sugar and energy
beside it. Keep one meal to compare it with the next: the kept meal is a dashed line on every
graph. You can see how fast each leaves
the stomach, where the carbohydrate, protein, fat, fibre and water go, and how blood sugar
typically responds.
Other living things (animals, plants, cells) are planned.

It is built for classrooms:

- a projector mode
- English and Hindi
- every graph can be read as a table, and every control works from the keyboard or a presentation clicker
- works offline once loaded
- every comparison has a link you can share

> **Educational, not medical advice.** LifePeek is a simplified model of a typical healthy adult.
> Its times and blood-sugar values are typical ranges and vary a lot between people. Don't use it
> to make health, diet or medical decisions.

**Privacy:** LifePeek has no accounts, no ads, no cookies and no analytics, and collects no
personal data. See the [Privacy page](https://lifepeek.vercel.app/privacy).

**Made by** [Sarthak (@Sarthaks-24)](https://github.com/Sarthaks-24). Every number is cited;
found a mistake? Use "Report a mistake" in the app or [open an issue](https://github.com/Sarthaks-24/lifepeek/issues).

## Run it locally

```bash
npm install
npm run dev        # web app → http://localhost:5173
npm run dev:api    # optional API for "report a mistake" → http://localhost:8787
```

The web app works without the API: links carry the whole comparison, and error reports open as a GitHub issue.
To send reports to the local API instead, put `VITE_API_URL=/api` in `apps/web/.env.development.local`.

```bash
npm run check      # validate foods, typecheck, unit tests, production build
npm run e2e -w @lifepeek/web   # browser smoke + release-gate tests (needs: npx playwright install chromium)
npm run budget -w @lifepeek/web  # download-size budgets of the last build
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

- **Web:** any static host. `npm run build -w @lifepeek/web` writes `apps/web/dist`. Rewrite all paths to `index.html` (`vercel.json` is included). Leave `VITE_API_URL` empty: reports then open as a GitHub issue and the app sends nothing. Set it only if you run the API.
- **API:** any Node 20+ host. Run `npm start -w @lifepeek/api` with these settings (see `apps/api/.env.example`):
  - `DATABASE_URL`: a Turso/libSQL URL, or `file:lifepeek.db`
  - `DATABASE_AUTH_TOKEN`: the database token
  - `ALLOWED_ORIGINS`: the origins allowed to call the API
  - `ADMIN_TOKEN`: the token for reading error reports
  - `TRUST_PROXY=1`: only behind a proxy you control that sets `X-Forwarded-For`

## Licence

| What | Licence |
|---|---|
| Code | [Apache License 2.0](LICENSE). Keep the [NOTICE](NOTICE) file in copies. |
| Lesson text, translations, illustrations, docs, and our own food-file structure and labels | [CC BY 4.0](LICENSE-CONTENT.md). Credit: "LifePeek by Sarthak, https://lifepeek.vercel.app, CC BY 4.0". |
| Nutrient and GI values from USDA, the Indian Nutrient Databank, Atkinson et al. and others | **Not relicensed by us.** Cited in each food file; see [DATA-SOURCES.md](DATA-SOURCES.md). |
| The LifePeek name and logo | Not licensed. Forks must use a different name; see [TRADEMARKS.md](TRADEMARKS.md). |
| Bundled libraries and fonts | Their own licences; see [`/THIRD_PARTY_NOTICES.txt`](https://lifepeek.vercel.app/THIRD_PARTY_NOTICES.txt). |

Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md) (commits must be signed off with `git commit -s`)
and [GOVERNANCE.md](GOVERNANCE.md).
