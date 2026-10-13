# Changelog

All notable changes to LifePeek. Data corrections are listed here so teachers can see what changed.

## 2.0.0 (unreleased)

A new, cleaner screen: one body, one meal, and the graphs that explain it.

- **New screen** at `/sim`: the body, the meal and the graphs fit on one laptop or projector
  screen with no scrolling. On a phone, the body, one graph and Play are in the first screen, and
  the site links are in a menu. Every link shared from 1.x still opens, as "this meal, with the
  other one kept"; `/next` (its address while it was tested) leads to `/sim`.
- **Home and Teach** redone for the new screen: three ready lessons that open on the projector at
  their first key moment, four questions to check understanding, a QR code for students' phones,
  and a share picture and install screenshots.
- **A default person**: an adult model (the ICMR-NIN 2020 reference man, 65 kg, resting).
- **Graphs**: blood sugar, food left in the stomach (in grams, with the half-empty mark
  explained), and energy eaten against energy used. Each graph says how we know, with its sources.
- **Keep to compare**: keep one meal, try another, and see the kept meal as a second line. Links
  remember the meal.
- **Timeline**: the key moments of digestion are marked, and a Now line follows the model.
- **Report a mistake** from the meal bar.
- **For every learner**: each graph has a summary sentence and a "Show as table" button; the whole
  screen works with the keyboard or a clicker (letter keys can be switched off); "reduce motion"
  stops auto-play.
- **3D**: one lit layer, labels that do not overlap, and fixes for cheap phones. Without 3D
  support, a flat drawing is shown instead.
- **Projector theme** redone for the back row; organ colours checked for contrast.
- **Hindi**: every screen checked for cut-off text; the reviewer's list exports as a spreadsheet.
- **`/stats`**: public counts of reported and fixed mistakes. No tracking, no server of our own.
- **Behind the scenes**: one list of every value the model shows, each tied to a sourced test;
  browser tests for every release check (no scroll, offline, no 3D, reduced motion, screen
  readers, frame rate); safer headers on the live site.
- Frame rate on a 2 GB Android Go phone: <fps, en and hi, 3D and flat>.
- Classroom test: <one line: 5 students and 1 teacher, tasks passed, faster than v1?>.

<!-- Before tagging: add a line for the removal of the old screen (WP-20), fill in the two lines above, and change the heading to "2.0.0". npm run release-gate checks this. -->

## 1.0.0 (first public release)

- Renamed from BioSim to LifePeek.
- Code under Apache-2.0, content under CC BY 4.0; NOTICE, TRADEMARKS, DATA-SOURCES.
- Privacy page, About page, 'not medical advice' note (English and Hindi).
- 15 cited foods; simulator, Teach and Science pages; projector mode; offline.
