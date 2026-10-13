# Student check before the swap

The new screen replaces the old simulator at `/sim` (WP-19). Before that change is merged, a few
students try it without help, so we know it teaches at least as well as the old screen did. This
is the "mini task check" of the screen council (MUST 8); the full task test (5 students and a
teacher, on the deployed site) comes again at the release gate (WP-22).

## Who and what you need

- 3 to 5 students of class 8 or 9 who have not used LifePeek before (or not the new screen).
- Their own phones, or one cheap Android phone passed round. Same Wi-Fi as your laptop.
- A timer (the phone's stopwatch), and this page to write on.
- Optional: a teacher with the projector, for the same four questions on the big screen.

## Start the screens on your laptop

The new screen is `/sim` on `main`. In Git Bash:

```bash
cd /e/BioSim && npm run build -w @lifepeek/web
cd /e/BioSim && npm run preview -w @lifepeek/web -- --host --port 4173
```

The old screen was deleted with the swap (WP-20); it lives on only at the local git tag
`v1-final` (`main` just before the swap), whose build has both screens: the old one at `/sim`, the
new one at `/next`. To run it, check the tag out in a worktree of its own, then build and preview
there (a different port, so both can run at once):

```bash
git -C /e/BioSim worktree add /e/BioSim/.claude/worktrees/v1-check v1-final
cd /e/BioSim/.claude/worktrees/v1-check && npm ci
cd /e/BioSim/.claude/worktrees/v1-check && npm run build -w @lifepeek/web
cd /e/BioSim/.claude/worktrees/v1-check && npm run preview -w @lifepeek/web -- --host --port 4180
```

When you are done, stop that preview and remove the worktree:
`git -C /e/BioSim worktree remove /e/BioSim/.claude/worktrees/v1-check`.

Vite prints a `Network:` address such as `http://192.168.1.23:4173/`. On each phone open that
address followed by a question's link (below). Close the medical note ("Got it") before you start
the timer. Stop the preview with Ctrl+C when you are done.

## The four questions

Open each question's link on the phone, read the question aloud, start the timer, and do not
help: don't point at the screen, don't name a button, don't say "look at the graph". Stop the
timer when the student answers (after 2 minutes it counts as wrong). Note what they tapped by
mistake or said out loud. Each question starts from the laptop's address followed by its link: the new screen's links are
below (on the `v1-final` build, write `/next` for `/sim`); the old screen's are in the private kit
and open on the `v1-final` build (port 4180).

| # | Say | Link | A right answer |
|---|---|---|---|
| 1 | "Cola is chosen. When has half of it left the stomach?" | `/sim?v=2&a=cola:1` | About 35 min (30–40) |
| 2 | "Now compare cola with a burger and fries. Which leaves the stomach faster, and why?" | `/sim?v=2&a=cola:1` | Cola, about 8× faster: a drink leaves at once, and has fewer calories |
| 3 | "What is blood sugar 1 hour after the cola?" | `/sim?v=2&a=cola:1` | About 111 mg/dL (105–115; its highest, 121, was at 35 min) |
| 4 | "At 3 hours, is more energy coming in from the cola, or is the body using more?" | `/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1` | Using more: coming in is almost 0, the body uses about 63 kcal/h |

If a student is stuck on question 2 after 90 s, the only help is its compared link,
`/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1` (score it "partly right").

The same questions are on the Teach page (`/teach`, "Four questions to check understanding"),
each with its link, and the answers in a closed "Answers for teachers" box. The full kit (script
in English and Hindi, the old screen side by side, score sheet) is kept privately in
`cache/student-check/KIT.md`.

## What to write down

One line per student:

| Student | Q1 done? / seconds | Q2 | Q3 | Q4 | What confused them |
|---|---|---|---|---|---|
| S1 | | | | | |
| S2 | | | | | |
| S3 | | | | | |

Score each answer Right (1), Partly (½) or Wrong (0), with its seconds.

**Pass:** on every question the new screen scores at least as much as the old one, and all but
one student get it right on the new screen (4 of 5, 3 of 4, 2 of 3). The old screen has no
energy graph, so question 4 only has to pass the second rule.

## After the check

Keep the full notes in `cache/` (private). Then tell the orchestrating session the result in one
line, for the WP-19 merge commit, for example:

`Student check 2026-10-14: 5 students (class 8–9, Android, EN/HI), new ≥ old on 4/4 questions, new right ≥ N−1 on 4/4 (new median 40 s vs old 55 s)`

If a question fails, the merge waits: say what confused the students; it is fixed first and
checked again with 2 new students.
