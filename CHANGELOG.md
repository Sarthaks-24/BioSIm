# Changelog

All notable changes to LifePeek. Data corrections are listed here so teachers can see what changed.

## 3.1.0 (unreleased)

**Class 10 Control and coordination, and how fat reaches the blood.** Three systems get their
numbers or a demo, and lungs, heart and kidneys can be turned round in 3D. Plants are still not
covered.

What students and teachers will notice:

- **Lymph & germ defence has graphs now** (it was a drawing only): "Fat’s road" shows fat from the
  meal travelling by lymph, and "Blood fat" shows it reaching the blood. After a cheeseburger with
  fries blood fat stays up for hours; after two rotis it hardly moves. Small dots run along the
  lymph route while fat is on its way. The germ-defence card is still there.
- **Hormones: insulin.** A graph shows insulin after the meal, as "× before eating" (water and an
  egg stay at 1×), beside blood sugar. The model works insulin out from the sugar coming in; it
  does not feed it back to pull blood sugar down (an "open loop"). The blood sugar line comes from
  real meals, so it already includes what insulin does. **It is not an injection guide**: the
  caption under the graph says so every time. Adrenaline, thyroxin, growth hormone and the hunger
  signal are short cards with no numbers ("Other hormones ›").
- **Brain & nerves: the hot-pan demo.** The same touch twice, slowed down: the reflex through the
  spinal cord reaches the arm muscle in about 64 thousandths of a second (ms), the route through
  the brain in about 214 ms. Counters show the real time. "Myelin off" (beyond class 10) shows
  why myelin matters (about 883 ms). With reduced motion it steps through still pictures.
- **3D lungs, heart and kidneys** on devices that can draw 3D: lungs breathing at the model’s
  rate, the heart and both loops of blood, the kidneys and a filling bladder. 3D is optional:
  the flat drawing shows the same numbers and is what every device gets without 3D. Labels stay
  on their organs while the view is turned.
- **The guided lesson** keeps five pauses; its Digestion pause is now about blood fat (lymph),
  and says what insulin did.
- **Teach** has a sixth chapter, **Control and coordination**: "Why do you pull your hand back
  before you feel the pain?" (the hot-pan demo) and "Who keeps blood sugar steady?" (insulin).
  "How does fat reach the blood?" joins Transportation. Each has a printable A4 worksheet with a
  QR code and a teacher’s copy, and a "Why different?" card with its NCERT page (Class 10, Ch 5
  p. 94; Ch 6 pp. 102 and 111).
- **Home** lists all ten systems with what each shows; **Science** lists the sources behind the
  new graphs and the demo.
- **Faster on slow phones**: on browsers that support it, the maths can run off the main thread,
  so taps answer sooner. While it works, the last picture stays on screen, dimmed, with "Working
  it out…". Other browsers work it out as before.

Model:

- **Model version stays 3.** Every number from 3.0 is unchanged (the seal check still passes);
  the new graphs (blood fat, insulin) are new outputs only. Links with `v=3` open as before.
- Blood fat starts at 80 mg/dL before eating, for one grown-up; many Indian adults start higher
  (116 mg/dL on average in the ICMR-INDIAB study), and "How we know" says so.
- The nerve demo is its own small calculation (nerve speeds, arm lengths, synapse and thinking
  times, each with its source); it does not use the meal clock.

Known limits:

- Insulin does not lower blood sugar in the model, and a walk does not change blood sugar.
  Diabetes is not modelled. Never use these numbers for insulin doses.
- The nerve demo times one average adult arm; children’s arms are shorter, so their times are
  shorter. The knee-tap reflex is not in it yet.
- Lymph and blood fat are for one resting grown-up; the germ-defence card has no numbers.
- 3D covers digestion, lungs, heart and kidneys; the other systems are flat drawings. Bones stays
  a drawing only.
- The background maths needs a browser that allows it; if it fails or is blocked, the page works
  it out itself, a little slower.
- Hindi is still paused: the site is English only.

## 3.0.0 (unreleased)

**Class 10 Life Processes, complete.** Lymph graphs, insulin and the nerve demo come in v3.1;
plants are not covered.

The same meal now shows what every body system does with it, and a walk or a run can be added to
see the body work harder.

What students and teachers will notice:

- **Seven more body systems**, picked from the title above the body (or with `[` and `]`, and `L`
  for the list): **Breathing** (lungs breathing at the model's rate, breaths a minute, air per
  breath, oxygen used and carbon dioxide made), **Heart & blood** (the heart beating, both loops
  of blood, beats a minute, blood pumped, and where the blood goes: gut or muscles), **Kidneys &
  water** (the bladder filling, urine made per hour, water in the body; these graphs show the
  first 12 hours, and "48 h ›" shows the rest), **Muscles**, **Skin & temperature** (sweat), and
  **Bones** and **Lymph & germ defence** as drawings only, with no graphs yet.
- **A walk, a brisk walk or a run** can be added to the meal, and kept to compare. Breathing, the
  heart, the muscles, sweat and the kidneys change with it; digestion and blood sugar do not. A
  link with a walk or run that names no system opens on Heart & blood.
- **The guided lesson "One roti, one walk: what does every system do?"**: five pauses, from the
  stomach to the kidneys, each with its question, the book's line and the model's answer. Next and
  Back, or a clicker's Page Down and Page Up. It is the first thing on Home and on Teach.
- **"Why different?"** next to each book value: the book's number with its NCERT chapter and page,
  the model's number, why they differ, and which one to write in the exam.
- **Teach** lists the lessons by NCERT chapter (Nutrition, Respiration, Transport, Excretion,
  Movement), with the classes each fits. Each lesson has a **printable A4 worksheet** with a QR
  code, a sketching question with empty axes, and a teacher's copy with the answers. "Save for
  class offline" now saves a system lesson's drawings too.
- **Count yours**: a 15-second timer for counting your own breaths or pulse. Nothing you count is
  typed in or saved.
- **Home** shows the systems, and **Science** lists the sources behind each system.
- **Phones**: a graph with two lines (Energy, Urine made per hour) no longer runs under the play
  bar on a small phone with a kept meal.

Model:

- **Model version 3 is sealed.** Its numbers are final: every output (each graph line, each key
  moment) is pinned by a check that runs on every change, so a link made with `v=3` gives the same
  picture in every later 3.x release. A change to any of them would be model version 4, listed
  here with what changed and why.
- Compared with version 2, the small intestine takes in 90 % of the water (was 80 %), 97 % of the
  carbohydrate (was 95 %) and 95 % of the protein (was 90 %), as the textbook says. Energy coming
  in is about 2–3 % higher; blood sugar peaks are at most 1 mg/dL higher; times in the stomach did
  not change. Links made with version 2 still open, with a note that some numbers may differ.
- The new systems are one resting grown-up (65 kg) in a simple model: each value says where it
  comes from, and "How we know" lists its limits.

Known limits:

- Lymph & germ defence and Bones are drawings only in this release: the lymph graphs come in v3.1,
  with insulin and the nerve demo. Plants are not covered.
- The new systems are flat drawings on every device; the 3D body shows digestion.
- Body temperature is held at 37 °C, not worked out: the model works out the sweat instead. The
  heart is back to resting within a few minutes of stopping; a real one stays a little fast for longer. Air breathed out is shown as the
  book's numbers only.
- Only walking, brisk walking and running can be added.
- Hindi is still paused: the site is English only.

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
