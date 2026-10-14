import { activeStage, gutIsDone, leftBodyAtEnd, mealLocationAt, type MealLocation, type RunResult, type StageId } from '@lifepeek/engine'

/**
 * Where the meal is now, in words a class 7–10 student reads at a glance (council round 2, C1):
 * not just the organ the body lights, but how much of the meal is there and where a good part of
 * the rest has gone ("Stomach: about half of it is here · some already in the small intestine").
 * Read from the model's own location signals (`mealLocationAt`, grams of tracked nutrients).
 *
 * - `stage` is the organ the body lights (`activeStage`), so the words and the picture agree;
 *   `done` once the gut has finished with the meal (`gutFinished`), where the body keeps the last
 *   organ lit (review 14-17, HIGH 1).
 * - `here` is that organ's share of the meal, as a word (`Amount`).
 * - `also` is the biggest other part, if it is a real part (≥ 15 %): further along (the small or
 *   large intestine, or already taken into the body) or, behind, still in the stomach.
 *
 * Pure, so the rules are unit-tested; the Now line re-renders only when the words change (`nowKey`).
 */
export type Amount = 'all' | 'most' | 'half' | 'some' | 'little'
export type Place = 'stomach' | 'smallIntestine' | 'largeIntestine' | 'body'

export type NowWhere =
  | { kind: 'before'; stage: 'mouth' | 'esophagus' }
  | { kind: 'gut'; stage: 'stomach' | 'smallIntestine' | 'largeIntestine'; here: Amount; also: { place: Place; amount: Amount } | null }
  /**
   * `body`: the share taken into the body. `restLeft`: the meal has leftovers (fibre and the
   * like, the "leftovers start leaving" moment), and they have left the body as waste.
   */
  | { kind: 'done'; stage: 'done'; body: Amount; restLeft: boolean }

/** A share of the meal (0–1) as a word. "About half" is 40–60 %, so it is never wrong by much. */
export function amountOf(share: number): Amount {
  if (share >= 0.9) return 'all'
  if (share >= 0.6) return 'most'
  if (share >= 0.4) return 'half'
  if (share >= 0.15) return 'some'
  return 'little'
}

/** Below this share another place is not worth naming. */
const ALSO_MIN = 0.15

const GUT: readonly Place[] = ['stomach', 'smallIntestine', 'largeIntestine', 'body']

const shareIn = (loc: MealLocation, place: Place) =>
  (place === 'body'
    ? loc.absorbed
    : place === 'smallIntestine'
      ? loc.smallIntestine
      : place === 'largeIntestine'
        ? loc.largeIntestine
        : loc.stomach) / loc.total

/** The large intestine has passed on all but this share of what will leave the body. */
const LEFTOVERS_DONE = 0.1

/** The large intestine has passed on (nearly) all the waste it will pass on in this run. */
const wastePassed = (run: RunResult, loc: MealLocation) => loc.largeIntestine <= LEFTOVERS_DONE * leftBodyAtEnd(run)

/**
 * The gut has finished with the meal: the engine's test (`gutIsDone`: under 1 % of the meal still
 * in the gut), never before the leftovers start leaving (the marker's typical time), and, since
 * that 1 % counts the meal's water, the large intestine has also passed on nearly all it will
 * (FIX-C review: "done" used to start while a fifth to a half of the waste was still in the colon,
 * yet said "the rest left as waste").
 *
 * A big meal (three burgers and fries) is still passing its last waste at 48 h, and against the
 * little that has left by then the colon's last grams never look "nearly all": at the run's last
 * minute the engine's test alone is enough (review FIX-D + WP-18, MED 1), and the words then
 * claim only what was absorbed (`restLeft` is false), not that the rest has left. A meal still in the
 * stomach or the intestines at 48 h (several kilos, over the model's limit, which the notes say)
 * is not done: the line says where it still is.
 */
export function gutFinished(run: RunResult, tMin: number, loc: MealLocation = mealLocationAt(run, tMin)): boolean {
  if (!gutIsDone(loc)) return false
  const exit = run.events.firstExit
  if (exit && tMin < exit.typical) return false
  // The run's last minute: the meal clock stops here.
  return wastePassed(run, loc) || tMin >= run.horizonMin
}

export function nowWhere(run: RunResult, tMin: number): NowWhere {
  const stage: StageId = activeStage(run, tMin)
  if (stage === 'mouth' || stage === 'esophagus') return { kind: 'before', stage }
  const loc = mealLocationAt(run, tMin)
  // Only a meal with leftovers (the "leftovers start leaving" moment) has a rest that leaves as
  // waste, and only once it has left; for cola or water the words say what v1 did: (almost) all
  // of it was absorbed.
  if (gutFinished(run, tMin, loc))
    return {
      kind: 'done',
      stage: 'done',
      body: amountOf(loc.absorbed / loc.total),
      restLeft: run.events.firstExit !== null && wastePassed(run, loc),
    }
  const at = GUT.indexOf(stage)
  // Further along first (where the meal is going), then the stomach behind it.
  const candidates = [...GUT.slice(at + 1), ...(at > 0 ? (['stomach'] as const) : [])]
  let also: { place: Place; share: number } | null = null
  for (const place of candidates) {
    const share = shareIn(loc, place)
    if (share >= ALSO_MIN && (!also || share > also.share)) also = { place, share }
  }
  return { kind: 'gut', stage, here: amountOf(shareIn(loc, stage)), also: also && { place: also.place, amount: amountOf(also.share) } }
}

/**
 * The words' identity: equal keys say the same thing. `nowWhere` builds each kind of words with
 * its fields in one order, so the JSON text is that identity (and the smallest code for it: the
 * stage's first download has no room to spare).
 */
export const nowKey = (w: NowWhere): string => JSON.stringify(w)

export const parseNowKey = (key: string): NowWhere => JSON.parse(key) as NowWhere

/** Every set of words this run's Now line will say, in order: the line keeps the room of the longest. */
export function nowKeysOf(run: RunResult): string[] {
  const keys = new Set<string>()
  for (let t = 0; t <= run.horizonMin; t += run.stepMin) keys.add(nowKey(nowWhere(run, t)))
  return [...keys]
}
