# Contributing

Thanks for helping make LifePeek better. A few ground rules first:

- Every commit must be **signed off** (`git commit -s`). See [Sign your commits (DCO)](#sign-your-commits-dco).
- Code you contribute is licensed under **Apache-2.0** ([LICENSE](LICENSE)); text, translations and
  pictures under **CC BY 4.0** ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)). You keep your copyright.
- Food values follow the data rule in [DATA-SOURCES.md](DATA-SOURCES.md).
- How decisions are made: [GOVERNANCE.md](GOVERNANCE.md).

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

   **Data rule: a few cited values per food, never bulk-copied tables.** Copy only the numbers this
   one food needs and cite the exact record (FDC ID, recipe code, table entry). Don't import a
   whole table, database file or a table's layout. AI chat answers are not sources.

   Indian Food Composition Tables 2017 and the Indian Nutrient Databank: we have asked their
   authors for permission to reuse values. Until [DATA-SOURCES.md](DATA-SOURCES.md) says the answer
   is yes, don't add **new** foods from them; open an issue instead.
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
- After a change, run `npm test -w @lifepeek/engine`. The golden tests compare the model with
  published data. If one fails, either fix your change or add a citation that explains why the
  reference range should move.
- Bump `MODEL_VERSION` whenever the outputs change.
- Update `docs/MODEL.md`.

## Code

- Run `npm run check` before you push (validate, typecheck, test, build).
- **AI-assisted code is the committer's responsibility.** You may use AI tools, but by signing off
  you confirm that you have read the code, understand it, can explain it in review, and have the
  right to submit it. Don't paste in code from projects with incompatible licences. Mentioning AI
  help in the pull request is welcome.
- Translation text in `apps/web/src/i18n/` is content (CC BY 4.0), even though it sits next to code.
- Translations live in `apps/web/src/i18n/en.json` and `hi.json`. Keep the keys identical in both.
- Accessibility is part of "done":
  - everything works with the keyboard
  - colour is never the only cue
  - motion respects `prefers-reduced-motion`

## Sign your commits (DCO)

LifePeek uses the [Developer Certificate of Origin 1.1](https://developercertificate.org/) (DCO)
instead of a contributor licence agreement. Signing off means you certify that you wrote the change,
or otherwise have the right to submit it under the project's licences.

Add `-s` to every commit:

```bash
git commit -s -m "Add poha (IFCT 2017)"
```

This adds a line like this to the commit message:

```text
Signed-off-by: Your Name <your-github-noreply-address@users.noreply.github.com>
```

- Use your GitHub **noreply** address (GitHub → Settings → Emails), not a personal email.
  The sign-off is public and stays in the history forever.
- Use a real name or your usual GitHub name. No anonymous sign-offs.
- Forgot? Fix the last commit with `git commit --amend -s --no-edit`, or every commit on your
  branch with `git rebase --signoff main`, then `git push --force-with-lease`.
- A DCO check runs on every pull request and blocks the merge if a commit isn't signed off.

The full text you are agreeing to:

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Privacy in issues and pull requests

Issues and pull requests are public. Don't put your own or anyone else's name, school, phone
number or health details in them. See the Privacy page in the app.
