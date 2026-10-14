/**
 * Reproduction's static data (R-1; model §2.12, R114): not engine output, no meal or activity moves
 * it, and nothing here is about any one person. Two panels use it (systems/reproduction/Panels.tsx):
 * three hormones over one cycle, drawn relative (low to high), and the book's height table.
 *
 * Hormones: the sub-phase medians of Anckaert et al. 2021 (Table 1, read in V-0 item 22 and again
 * for R-1), on the study's own standardised cycle, whose day spans are its Supplementary table S3
 * (read for R-1 in the supplement, mmc1.docx): "The standardized cycle length was defined as 29
 * days, with day of ovulation occurring on menstrual cycle day 15"; follicular and luteal phases
 * "were divided into three further sub-phases (early/intermediate/late), each with a length of 4.3
 * days"; "The ovulation phase lasted 3 days" (days 14–16). Each median sits at the middle of its
 * sub-phase. The book draws a 28-day cycle with the egg released on day 14 (NCERT Class 9
 * *Exploration* ch. 11, Fig. 11.21), so the study's days are moved onto the book's: the luteal half
 * keeps its 14 days (one day earlier), and the follicular half (study days 1–15) is pressed into the
 * book's days 1–14. Each hormone is shown as a share of its own highest median: the three are
 * measured in different units, so only their rises and falls compare, never their heights.
 * Between the anchors the line is a monotone curve (Fritsch–Carlson): it passes through every
 * median and never overshoots, so each hormone's highest point is one of its medians.
 *
 * Height: the table of NCERT Class 8 *Science* ch. 7 (Activity 7.1, p. 80, 2024-25 print) and its
 * worked example. The book also asks pupils to work out their own height; the app does not (no
 * box for a child's height or cycle: body image and personal data, model §2.12).
 */

/** The sources (Science lists them when the row is on; their anchors are these IDs). */
export const REPRO_SOURCES = {
  anckaert2021: {
    citation:
      'Anckaert E, Jank A, Petzold J, et al. Extensive monitoring of the natural menstrual cycle using the serum biomarkers estradiol, luteinizing hormone and progesterone. Pract Lab Med 2021;25:e00211 (Table 1; Supplementary tables S2, S3).',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8042396/',
  },
  'ncert-9-exploration-11': {
    citation: 'NCERT. Exploration, Grade 9, chapter 11: Reproduction: How Life Continues, p. 221 (Fig. 11.21). 2026-27.',
    url: 'https://ncert.nic.in/textbook/pdf/iesc111.pdf',
  },
  'ncert-8-ch7': {
    citation: 'NCERT. Science, Class 8, chapter 7: Reaching the Age of Adolescence, p. 80 (Activity 7.1). 2024-25 print.',
    url: 'https://ncert.nic.in/textbook/pdf/hesc107.pdf',
  },
  'ncert-10-ch7': {
    citation: 'NCERT. Science, Class 10, chapter 7: How do Organisms Reproduce?, p. 124. Reprint 2026-27.',
    url: 'https://ncert.nic.in/textbook/pdf/jesc107.pdf',
  },
} as const
export type ReproSourceId = keyof typeof REPRO_SOURCES

/** The sources in the order Science lists them under the row. */
export const REPRO_SOURCE_IDS = Object.keys(REPRO_SOURCES) as ReproSourceId[]

export const HORMONES = ['estrogen', 'lh', 'progesterone'] as const
export type Hormone = (typeof HORMONES)[number]

/** Anckaert 2021's seven sub-phases, in cycle order. */
export const PHASES = ['follicularEarly', 'follicularMid', 'follicularLate', 'ovulation', 'lutealEarly', 'lutealMid', 'lutealLate'] as const
export type Phase = (typeof PHASES)[number]

/**
 * Each sub-phase's days on the study's standardised 29-day cycle (Supplementary table S3: early
 * follicular "0; 4.333", intermediate "4.334; 8.667", late "8.668; 13", ovulation "14; 16", early
 * luteal "17; 20.333", intermediate "20.334; 24.667", late "24.668; 29").
 */
export const STUDY_DAYS: { readonly [P in Phase]: readonly [number, number] } = {
  follicularEarly: [0, 4.333],
  follicularMid: [4.334, 8.667],
  follicularLate: [8.668, 13],
  ovulation: [14, 16],
  lutealEarly: [17, 20.333],
  lutealMid: [20.334, 24.667],
  lutealLate: [24.668, 29],
}

/**
 * Sub-phase medians (Anckaert 2021, Table 1): estradiol pmol/L, LH IU/L, progesterone nmol/L.
 * Kept in their units so the test can check them against the paper; the panel shows them relative.
 */
export const MEDIANS: { readonly [H in Hormone]: { readonly [P in Phase]: number } } = {
  estrogen: {
    follicularEarly: 125,
    follicularMid: 172,
    follicularLate: 464,
    ovulation: 817,
    lutealEarly: 390,
    lutealMid: 505,
    lutealLate: 396,
  },
  lh: {
    follicularEarly: 6.41,
    follicularMid: 7.36,
    follicularLate: 8.52,
    ovulation: 24.0,
    lutealEarly: 9.66,
    lutealMid: 5.36,
    lutealLate: 5.0,
  },
  progesterone: {
    follicularEarly: 0.38,
    follicularMid: 0.21,
    follicularLate: 0.188,
    ovulation: 1.59,
    lutealEarly: 22.6,
    lutealMid: 39.2,
    lutealLate: 18.2,
  },
}

/** The study's cycle (Supplementary table S2): 29 days (STUDY_DAYS ends on day 29), the egg on day 15. */
export const STUDY_OVULATION = 15
/** The book's (NCERT Class 9 Fig. 11.21): "a typical 28-day period", "Day 14: Ovulation". */
export const CYCLE_DAYS = 28
export const OVULATION_DAY = 14
/** The book's range and its usual length (NCERT Class 9 p. 221): "typically every 21-35 days (often around 28 days)". */
export const CYCLE_RANGE = [21, 35] as const
/** Its days of menstruation (p. 221: "usually lasts 3 to 7 days"; Fig. 11.21 draws "Day 1-5"). */
export const MENSTRUATION_RANGE = [3, 7] as const
export const MENSTRUATION_DRAWN = [1, 5] as const

/**
 * A study day on the book's 28-day cycle: the follicular days 1–15 pressed into 1–14 (S2's own
 * formula, `1 + (day − 1) × 14 / length`, with the book's 13 days in place of the study's 14), the
 * luteal days 15–29 moved one day earlier (both are 14 days long).
 */
export function toBookDay(studyDay: number): number {
  const fol = OVULATION_DAY - 1
  const studyFol = STUDY_OVULATION - 1
  return studyDay <= STUDY_OVULATION ? 1 + ((studyDay - 1) * fol) / studyFol : studyDay - (STUDY_OVULATION - OVULATION_DAY)
}

/** Each sub-phase's median sits at the middle of its days, on the book's cycle. */
export const ANCHOR_DAYS: { readonly [P in Phase]: number } = Object.fromEntries(
  PHASES.map((p) => [p, toBookDay((STUDY_DAYS[p][0] + STUDY_DAYS[p][1]) / 2)]),
) as { [P in Phase]: number }

/** A hormone's medians as shares of its highest (1 = its highest median). */
export function relativeMedians(h: Hormone): readonly number[] {
  const values = PHASES.map((p) => MEDIANS[h][p])
  const top = Math.max(...values)
  return values.map((v) => v / top)
}

/**
 * Monotone cubic Hermite slopes (Fritsch–Carlson) through the points: a curve through every point
 * that keeps each stretch between two points rising, falling or flat as the points do (no overshoot).
 */
function slopes(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length
  const d = xs.slice(1).map((x, i) => (ys[i + 1]! - ys[i]!) / (x - xs[i]!))
  const m = xs.map((_, i) => (i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i]! / d[i]!
    const b = m[i + 1]! / d[i]!
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * a * d[i]!
      m[i + 1] = tau * b * d[i]!
    }
  }
  return m
}

/**
 * A hormone's relative level (its highest median = 1) on a day of the book's cycle, day 0 = day 28.
 * The cycle repeats, so the anchors are wrapped round once each side: the line leaves day 28 as it
 * enters day 1.
 */
export function makeCurve(h: Hormone): (day: number) => number {
  const ys0 = relativeMedians(h)
  const xs0 = PHASES.map((p) => ANCHOR_DAYS[p])
  const xs = [...xs0.slice(-2).map((x) => x - CYCLE_DAYS), ...xs0, ...xs0.slice(0, 2).map((x) => x + CYCLE_DAYS)]
  const ys = [...ys0.slice(-2), ...ys0, ...ys0.slice(0, 2)]
  const m = slopes(xs, ys)
  return (day: number) => {
    const x = ((day % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
    let i = 0
    while (i < xs.length - 2 && x > xs[i + 1]!) i++
    const h0 = xs[i + 1]! - xs[i]!
    const t = (x - xs[i]!) / h0
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h0 * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h0 * m[i + 1]!
  }
}

/**
 * NCERT Class 8's table (p. 80): "% of full height" reached at each age, boys and girls. "These
 * figures are only representative and there may be individual variations."
 */
export const HEIGHT_TABLE: readonly { age: number; boys: number; girls: number }[] = [
  { age: 8, boys: 72, girls: 77 },
  { age: 9, boys: 75, girls: 81 },
  { age: 10, boys: 78, girls: 84 },
  { age: 11, boys: 81, girls: 88 },
  { age: 12, boys: 84, girls: 91 },
  { age: 13, boys: 88, girls: 95 },
  { age: 14, boys: 92, girls: 98 },
  { age: 15, boys: 95, girls: 99 },
  { age: 16, boys: 98, girls: 99.5 },
  { age: 17, boys: 99, girls: 100 },
  { age: 18, boys: 100, girls: 100 },
]

/** The book's worked example (p. 80): "A boy is 9 years old and 120 cm tall" → "160 cm tall". */
export const HEIGHT_EXAMPLE = { age: 9, heightCm: 120, who: 'boys' } as const

/** The book's formula: full height = present height × 100 ÷ % of full height at this age. */
export const fullHeightCm = (heightCm: number, pctOfFull: number) => (heightCm * 100) / pctOfFull
