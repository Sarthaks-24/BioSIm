# Decisions

These are short records of the choices behind the code.

## 2026-10-12: Rebuild from scratch after a council review

The original plan was a frontend-only learning project with hand-typed timings and vitals. It was
reviewed by five independent advisor perspectives plus peer review.

**What changed:**

- **Comparison is the product.** A dot drifting through one body teaches little. Two meals side
  by side show cause and effect.
- **Food files hold only cited inputs; the engine computes the outputs.** If timings are typed by
  hand, they are invented, and you cannot combine foods.
- **Dropped heart rate, "energy" and hydration.** None of them can be sourced per meal. Glucose
  is shown as a typical-range band.
- **Organs are built in code instead of a downloaded model.** There is no licensing issue and no
  large download. The organs match the particle paths exactly and can change shape, for
  example a stomach that swells with its contents.
- **No student accounts.** Collecting data on minors brings legal exposure (India's DPDP Act,
  COPPA, FERPA). Teacher accounts will only be added when pilot teachers ask to save work.

## 2026-10-12: Hono + libSQL instead of Supabase

The council suggested Supabase for the small backend. We chose Hono + Drizzle + libSQL because:

- it runs locally with no accounts;
- it can be tested in CI with an in-memory database;
- the whole repo stays in one language;
- there is no vendor lock-in.

Turso hosts libSQL in production.

## 2026-10-12: TypeScript and no GSAP

We use TypeScript because two junior developers will maintain code that an agent wrote, and types
make it safer to change. There is no GSAP, because a single simulation clock drives every visual.

## 2026-10-12: Non-linear timeline

The timeline covers 0–48 h, and the first 6 h take 60 % of its width. Stomach emptying and blood
sugar happen in those first hours. If the scale were linear, they would be squeezed into an eighth
of the bar.
