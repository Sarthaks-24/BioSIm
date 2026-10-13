import { activeStage, gutIsDone, mealLocationAt, type MealLocation, type Simulation, type StageId } from '@lifepeek/engine'

/**
 * Where the meal is now, in words a class 7–10 student reads at a glance (council round 2, C1):
 * not just the organ the body lights, but how much of the meal is there and where a good part of
 * the rest has gone ("Stomach: about half of it is here · some already in the small intestine").
 * Read from the model's own location signals (`mealLocationAt`, grams of tracked nutrients).
 *
 * - `stage` is the organ the body lights (`activeStage`), so the words and the picture agree;
 *   `done` once the gut has (all but) finished with the meal (engine `gutIsDone`), where the
 *   body keeps the last organ lit (review 14-17, HIGH 1).
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
  /** `body`: the share taken into the body; the rest (if any) left it as waste. */
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

export function nowWhere(run: Simulation, tMin: number): NowWhere {
  const stage: StageId = activeStage(run, tMin)
  if (stage === 'mouth' || stage === 'esophagus') return { kind: 'before', stage }
  const loc = mealLocationAt(run, tMin)
  if (gutIsDone(loc))
    return { kind: 'done', stage: 'done', body: amountOf(loc.absorbed / loc.total), restLeft: loc.leftBody / loc.total >= 0.01 }
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

/** The words' identity: equal keys say the same thing ("stomach|half|smallIntestine:some"). */
export function nowKey(w: NowWhere): string {
  if (w.kind === 'before') return w.stage
  if (w.kind === 'done') return `done|${w.body}|${w.restLeft ? 1 : 0}`
  return `${w.stage}|${w.here}|${w.also ? `${w.also.place}:${w.also.amount}` : ''}`
}

export function parseNowKey(key: string): NowWhere {
  const [stage, a, b] = key.split('|') as [string, string?, string?]
  if (stage === 'mouth' || stage === 'esophagus') return { kind: 'before', stage }
  if (stage === 'done') return { kind: 'done', stage, body: a as Amount, restLeft: b === '1' }
  const [place, amount] = (b ?? '').split(':')
  return {
    kind: 'gut',
    stage: stage as 'stomach' | 'smallIntestine' | 'largeIntestine',
    here: a as Amount,
    also: place ? { place: place as Place, amount: amount as Amount } : null,
  }
}

/** Every set of words this run's Now line will say, in order: the line keeps the room of the longest. */
export function nowKeysOf(run: Simulation): string[] {
  const keys = new Set<string>()
  for (let t = 0; t <= run.horizonMin; t += run.stepMin) keys.add(nowKey(nowWhere(run, t)))
  return [...keys]
}
