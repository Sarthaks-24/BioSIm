# Content licence: CC BY 4.0

LifePeek's **code** is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)).

LifePeek's own **teaching content** is licensed under the
**Creative Commons Attribution 4.0 International licence (CC BY 4.0)**.

- Summary: <https://creativecommons.org/licenses/by/4.0/>
- Full legal code: <https://creativecommons.org/licenses/by/4.0/legalcode>

Copyright 2026 Sarthak (GitHub: Sarthaks-24) and LifePeek contributors.

## What you may do

You may copy, share, translate, adapt and remix the content for any purpose, including in
worksheets, slides, textbooks, coaching material and commercial products, as long as you
**give credit**:

1. Name the source: **"LifePeek by Sarthak, https://lifepeek.vercel.app"**.
2. Link the licence: **CC BY 4.0, https://creativecommons.org/licenses/by/4.0/**.
3. Say if you changed it, for example "translated into Marathi" or "shortened".

Example credit line for a worksheet:

> Text adapted from LifePeek (https://lifepeek.vercel.app) by Sarthak, CC BY 4.0. Shortened for Class 8.

You don't need to ask permission. Telling us is welcome (open a GitHub issue), so we can link to good uses.

## What this licence covers

| Covered (CC BY 4.0) | Where it lives |
|---|---|
| Lesson and explanation text: stage descriptions, "chemistry" notes, facts, teacher lesson plans, questions and tips, the Science page text | `apps/web/src/i18n/en.json` |
| Translations of that text (Hindi and any later language) | `apps/web/src/i18n/hi.json` and other files in `apps/web/src/i18n/` |
| Illustrations, diagrams and screenshots made for the project (not the logo) | `apps/web/public/`, `docs/` (none yet; the icons are the logo, see TRADEMARKS.md) |
| The project's own documentation prose | `docs/*.md`, `README.md`, `CONTRIBUTING.md` |
| Our own work in the food files: the JSON structure and schema, food IDs, food names and Hindi names, serving labels and descriptions, and notes we wrote | `content/foods/*.json` |

The i18n files sit inside the code folder, but their **text** is content and falls under CC BY 4.0.
The code that loads and displays them is Apache-2.0.

## What this licence does NOT cover

- **Values copied from other sources.** Nutrient amounts, serving weights and glycemic-index values
  come from USDA FoodData Central, the Indian Nutrient Databank, Atkinson et al. 2008 and others.
  We cite them; we do not own them and do not relicense them. Each value keeps its owner's terms.
  See [DATA-SOURCES.md](DATA-SOURCES.md) and the `sources` field in every food file.
- **Facts and published research.** Physiology facts and constants from papers are cited in
  `docs/MODEL.md` and `packages/engine/src/params.ts`. The facts are not ours to license.
- **The LifePeek name and logo.** They are not licensed under CC BY 4.0 or Apache-2.0.
  See [TRADEMARKS.md](TRADEMARKS.md).
- **Source code**, including the code that draws the 3D organs. That is Apache-2.0 (see [LICENSE](LICENSE)).
- **Third-party fonts and libraries.** They keep their own licences
  (see `THIRD_PARTY_NOTICES.txt`, generated at build time).

## No warranty, and not medical advice

The content is provided "as is", without warranty (see sections 5 and 6 of the CC BY 4.0 legal code).
LifePeek is an educational model of a typical healthy adult. It is **not medical advice** and must
not be used to make health, diet or medical decisions.
