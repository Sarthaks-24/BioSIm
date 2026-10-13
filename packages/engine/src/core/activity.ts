/**
 * Activity bouts (model D18, architecture §0 and §2): what the person does besides resting, as
 * input to a run. A bout is one kind of activity from a start minute for a number of minutes, on
 * the meal clock. No bout = resting (MET 1.0, Compendium 07021), so a run without activity is
 * exactly the run without this file.
 *
 * The codec (share.ts, `act` and `bact`) knows all seven kinds, so a later kind never needs a link
 * change. Only the `public` ones (the three whose Compendium rows were read, V-0 / V-0b) are
 * offered or opened from a link; the others stay hidden until their rows are checked (v3.2+).
 * Each kind's MET is in PARAMS.activity.met (params.ts), next to its Compendium code here.
 */

/** The seven kinds (frozen, architecture §2). The order is the codec's and the UI's. */
export const ACTIVITY_KINDS = ['walk', 'walkBrisk', 'run', 'sitClass', 'football', 'cricket', 'badminton'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export interface ActivityKindDef {
  /** 2024 Adult Compendium activity code (pacompendium.com). */
  code: string
  /** Offered in the app and opened from links. Hidden kinds stay hidden until their rows are verified. */
  public: boolean
}

/** Compendium codes (V-0 item 1 and 9; V-0b item 1: none of the public rows is an estimated MET). */
export const ACTIVITY_KIND_DEFS: { readonly [K in ActivityKind]: ActivityKindDef } = {
  walk: { code: '17190', public: true }, // walking, 2.8–3.4 mph, level, moderate pace
  walkBrisk: { code: '17200', public: true }, // walking, 3.5–3.9 mph, level, brisk
  run: { code: '12050', public: true }, // running, 6–6.3 mph (10 min/mile)
  sitClass: { code: '09065', public: false }, // sitting in class, general
  football: { code: '15610', public: false }, // soccer, casual, general (not American football)
  cricket: { code: '15150', public: false }, // cricket, batting, bowling, fielding
  badminton: { code: '15030', public: false }, // badminton, social singles and doubles
}

export const isActivityKind = (k: string): k is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(k)
export const isPublicActivityKind = (k: string): k is ActivityKind => isActivityKind(k) && ACTIVITY_KIND_DEFS[k].public

/** One bout: `kind` from `startMin` for `durMin` minutes (meal clock; link form `kind.startMin.durMin`). */
export interface ActivityBout {
  kind: ActivityKind
  startMin: number
  durMin: number
}

/** The codec's limits (architecture §0): ≤ 8 bouts, start 0–2880, 5–120 min each, no overlap. */
export const ACTIVITY_LIMITS = { maxBouts: 8, startMin: 0, startMax: 2880, durMin: 5, durMax: 120 } as const

/** Whether one bout is inside the codec's limits on its own (whole minutes). */
export function boutInLimits(b: ActivityBout): boolean {
  const L = ACTIVITY_LIMITS
  return (
    isActivityKind(b.kind) &&
    Number.isInteger(b.startMin) &&
    Number.isInteger(b.durMin) &&
    b.startMin >= L.startMin &&
    b.startMin <= L.startMax &&
    b.durMin >= L.durMin &&
    b.durMin <= L.durMax
  )
}

/** The bouts in start order. */
export const sortBouts = (bouts: readonly ActivityBout[]): ActivityBout[] => [...bouts].sort((a, b) => a.startMin - b.startMin)

/**
 * What is wrong with a list of bouts, in words (empty = a valid plan): too many, a bout outside the
 * limits, or two bouts that overlap (one may start the minute the other ends).
 */
export function activityProblems(bouts: readonly ActivityBout[]): string[] {
  const problems: string[] = []
  if (bouts.length > ACTIVITY_LIMITS.maxBouts) problems.push(`more than ${ACTIVITY_LIMITS.maxBouts} bouts`)
  for (const b of bouts) if (!boutInLimits(b)) problems.push(`bout ${b.kind}.${b.startMin}.${b.durMin} is outside the limits`)
  const sorted = sortBouts(bouts)
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!
    const b = sorted[i]!
    if (b.startMin < a.startMin + a.durMin)
      problems.push(`bouts ${a.kind}.${a.startMin}.${a.durMin} and ${b.kind}.${b.startMin}.${b.durMin} overlap`)
  }
  return problems
}

/** The canonical text of a plan (the link form, in start order): `walk.30.20,run.240.10`; '' = rest. */
export const activityKey = (bouts: readonly ActivityBout[]): string =>
  sortBouts(bouts)
    .map((b) => `${b.kind}.${b.startMin}.${b.durMin}`)
    .join(',')
