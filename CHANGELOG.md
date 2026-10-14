# Changelog

All notable changes to LifePeek. Data corrections are listed here so teachers can see what changed.

## 3.0.0 (unreleased)

Model:

- **Model version 3 is sealed.** Its numbers are final: every output (each graph line, each key
  moment) is pinned by a check that runs on every change, so a link made with `v=3` gives the same
  picture in every later 3.x release. A change to any of them would be model version 4, listed
  here with what changed and why.

## 2.1.0 (unreleased)

The first public release of the new screen (2.0.0 below was never released on its own). It fixes
what a check on real phones, tablets and projectors found, and makes the site lighter.

What students and teachers will notice:

- **Phones**: the body shows on every phone screen, even small ones (320 px wide) and with the
  browser bars showing. The meal bar is one row; many foods fold into a "+3" chip instead of
  spilling off the screen; the less-used buttons are under "⋯".
- **Phone on its side (landscape)** and laptops zoomed to 200 %: the body on the left, the meal,
  graph and controls on the right, all without scrolling.
- **Projector**: on a 1024×768 projector the body fills at least 40 % of the screen, also with a
  kept meal; the graph summary sits under the graph; the projector colours are easier to read from
  the back row.
- **Timeline**: the key moments have their own lane and no longer cover the track; the time labels
  stay apart; "Keys and settings" never overlaps the timeline.
- **Graphs**: labels never sit on a line, the squeezed part of a graph is shown as a light hatch,
  and the tag says "Model estimate".
- **Pop-ups** ("How we know", the food sheet, menus): always fully on screen, below the header,
  with a Close button; Esc and the phone's Back button close them and keep your meal.
- **Links, Back and share**: Back closes an open sheet instead of leaving the site; Copy link and
  Share are there at every screen size (one click on a laptop); a link with a food we no longer
  have, too many foods or an impossible time opens with a note saying what changed; links made by
  a newer LifePeek offer "Update now".
- **The clock** keeps real time on slow phones, stops when you switch tabs, and does not jump.
  The "new version" note no longer shows by mistake.
- **Home**: the chart's text is readable on a phone, and "Open the simulator" is on the first
  screen.
- **Teach**: lesson step 2 says where the lesson starts (35 min); "Save for class offline" saves a
  lesson (or all of them) so it works with no internet in class, and shows "Ready for class
  offline ✓"; the QR code is made from the site's own address.
- **Page titles and link previews**: every page has its own title and description, so a link
  shared on WhatsApp or found in a search says which page it is; unknown addresses show a real
  "page not found".
- **Lighter site**: the app saves only its core for offline use (about 0.76 MB instead of 1.8 MB).
  The 3D body (about 1 MB) downloads only on a device that can show it, the first time it is
  opened; meanwhile the flat body works, with a note if the connection is slow.
- **Hindi is paused**: the site is English only for now, until a reviewer has checked every Hindi
  string. Links with `lang=hi` open in English with a short note.
- **Report form and privacy page**: one clear privacy warning in the report form; the project
  email on the privacy page is a tap-to-email link.
- Frame rate on a 2 GB Android phone: <fps, 3D and flat, from the device check>.
- Classroom check (5 students, 1 teacher): <one line: tasks passed, from the student check>.

Known limits:

- The 3D body needs the internet the first time it is opened; after that (or after "Save for
  class offline") it works offline. Without internet the flat body is shown.
- Hindi is not in this release (see above).
- On iPhone and iPad, a short drawing glitch while the page loads under heavy load is still being
  watched (it was not seen in our tests); a device check covers it.
- The frame-rate test in our browser checks is a report, not a pass mark: the real 2 GB phone
  check above is the one that counts.
- The model's numbers are unchanged from 2.0.0 (model version 2); the "How we know" panels list
  each value's source and its limits.

<!-- Before tagging: fill in the two lines above, and change the heading to "2.1.0". npm run release-gate checks this. -->

## 2.0.0 (unreleased)

A new, cleaner screen: one body, one meal, and the graphs that explain it.

- **New screen** at `/sim`: the body, the meal and the graphs fit on one laptop or projector
  screen with no scrolling. On a phone, the body, one graph and Play are in the first screen, and
  the site links are in a menu. Every link shared from 1.x still opens, as "this meal, with the
  other one kept"; `/next` (its address while it was tested) leads to `/sim`.
- **Removed the old two-body screen**: the two meal cards, the step-by-step tab, the key-moments
  table, the "where the meal has gone" bar and the old charts. The new screen does each of their
  jobs (the Now line and its "More" text, the timeline's key moments, "Show as table"), and the
  site downloads less.
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

<!-- Before tagging: fill in the two lines above, and change the heading to "2.0.0". npm run release-gate checks this. -->

## 1.0.0 (first public release)

- Renamed from BioSim to LifePeek.
- Code under Apache-2.0, content under CC BY 4.0; NOTICE, TRADEMARKS, DATA-SOURCES.
- Privacy page, About page, 'not medical advice' note (English and Hindi).
- 15 cited foods; simulator, Teach and Science pages; projector mode; offline.
