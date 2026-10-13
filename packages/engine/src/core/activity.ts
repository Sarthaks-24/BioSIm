/**
 * Activity bouts (model D18, architecture §0 and §2): what the person does besides resting, as
 * input to a run. A bout is one kind of activity from a start minute for a number of minutes, on
 * the meal clock. No bout = resting (MET 1.0, Compendium 07021), so a run without activity is
 * exactly the run without this file.
 *
 * The codec (share.ts, `act` and `bact`) knows all seven kinds, so a later kind never needs a link
 * change. Only the `public` ones (the three whose Compendium rows were read, V-0 / V-0b) are
 * offered or opened from a link; the others stay hidden until their rows are checked (v3.2+).
 * Each kind's MET is in PARAMS.activity.met (params.ts); its Compendium code in modules/activity.ts.
 */

/** The seven kinds (frozen, architecture §2). The order is the codec's and the UI's. */
export const ACTIVITY_KINDS = ['walk', 'walkBrisk', 'run', 'sitClass', 'football', 'cricket', 'badminton'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

/**
 * The kinds offered in the app and opened from links: the three whose 2024 Compendium rows were
 * read (V-0 item 1, V-0b item 1: none is an estimated MET). The other four stay hidden until their
 * rows are checked (v3.2+). The Compendium codes are in modules/activity.ts (the run's chunk).
 */
export const PUBLIC_ACTIVITY_KINDS: readonly ActivityKind[] = ['walk', 'walkBrisk', 'run']

export const isActivityKind = (k: string): k is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(k)
export const isPublicActivityKind = (k: string): k is ActivityKind => (PUBLIC_ACTIVITY_KINDS as readonly string[]).includes(k)

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

/** The canonical text of a plan (the link form, in start order): `walk.30.20,run.240.10`; '' = rest. */
export const activityKey = (bouts: readonly ActivityBout[]): string =>
  sortBouts(bouts)
    .map((b) => `${b.kind}.${b.startMin}.${b.durMin}`)
    .join(',')

/** One part of a link that could not be shown as written (the shape of share.ts's LinkChange). */
export interface ActivityLinkChange {
  param: string
  asked: string
  shown?: string
}

const BOUT_RE = /^([a-zA-Z]{1,20})\.(\d{1,5})\.(\d{1,4})$/
const MAX_ASKED = 40

/**
 * Reads a link's `act` or `bact` ("walk.30.20,run.240.10"; architecture §2). Every bout that is
 * dropped goes into `changes` with the link's own text, so the stage can name it (R21, bug B21):
 * a part that can't be read, a kind this version does not know or does not show yet (the hidden
 * four), a bout outside the limits, one that overlaps an earlier bout, and any past the eighth.
 * The plan comes back in start order. Only public kinds are read: a hidden kind's MET is not yet
 * verified, so it would fail the release gate.
 */
export function decodeActivity(raw: string | null | undefined, param = 'act', changes: ActivityLinkChange[] = []): ActivityBout[] {
  if (!raw) return []
  const L = ACTIVITY_LIMITS
  const drop = (asked: string) => changes.push({ param, asked: asked.slice(0, MAX_ASKED) })
  const parts = raw.split(',')
  // A huge link is not read part by part (so it can't make us loop for long): the rest is one part.
  const read: { bout: ActivityBout; text: string }[] = []
  for (const part of [...parts.slice(0, L.maxBouts * 2), parts.slice(L.maxBouts * 2).join(',')]) {
    const text = part.trim()
    if (!text) continue
    const m = BOUT_RE.exec(text)
    const bout = m && isPublicActivityKind(m[1]!) ? { kind: m[1]!, startMin: Number(m[2]), durMin: Number(m[3]) } : null
    if (bout && boutInLimits(bout)) read.push({ bout, text })
    else drop(text)
  }
  const kept: ActivityBout[] = []
  for (const { bout, text } of read.sort((x, y) => x.bout.startMin - y.bout.startMin)) {
    const last = kept.at(-1)
    if (kept.length >= L.maxBouts || (last && bout.startMin < last.startMin + last.durMin)) drop(text)
    else kept.push(bout)
  }
  return kept
}

/** The link form of a plan (`act` / `bact`): `walk.30.20,run.240.10`, in start order; '' = rest. */
export const encodeActivity = activityKey
