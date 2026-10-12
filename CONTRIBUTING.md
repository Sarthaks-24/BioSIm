# Contributing

## Add or correct a food (no coding needed)

1. Copy a similar file in `content/foods/`, for example `apple.json`. Name the new file after the
   food's `id` (`kebab-case`).
2. Fill in **one serving**:
   - `nutrients`: energy (kcal) and grams of available carbohydrate (not fibre), sugars, fibre,
     protein, fat and water.
   - `phase`: `liquid` for drinks, `solid` for everything else.
   - `glycemicIndex`: the published value (glucose = 100). Use `null` only if the food has less
     than 5 g of carbohydrate.
3. Cite sources. Every file needs a source for `nutrients`, and a source for `glycemicIndex` if it
   has one. Good sources:
   - USDA FoodData Central (link the FDC ID)
   - Indian Food Composition Tables 2017 / Indian Nutrient Databank
   - Atkinson et al. 2008 or 2021 GI tables

   Health blogs are not acceptable sources.
4. Add the Hindi name and serving label if you can. If not, English is used.
5. Run `npm run validate`. It checks:
   - the schema
   - that the nutrients fit in the serving
   - that energy roughly matches 4/4/9 kcal per gram
   - that the sources are present
6. Open a pull request. Say where each number came from.

You do **not** write timings or blood-sugar values. The model computes them.

## Change the model

- Every constant lives in `packages/engine/src/params.ts`, next to its citation.
- After a change, run `npm test -w @biosim/engine`. The golden tests compare the model with
  published data. If one fails, either fix your change or add a citation that explains why the
  reference range should move.
- Bump `MODEL_VERSION` whenever the outputs change.
- Update `docs/MODEL.md`.

## Code

- Run `npm run check` before you push (validate, typecheck, test, build).
- Translations live in `apps/web/src/i18n/en.json` and `hi.json`. Keep the keys identical in both.
- Accessibility is part of "done":
  - everything works with the keyboard
  - colour is never the only cue
  - motion respects `prefers-reduced-motion`
