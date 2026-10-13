/**
 * How many cases the slow suites run (R68). `npm test` runs a fixed, smaller set, so it passes the
 * same on a busy machine; `FULL=1 npm test` (the nightly CI run) runs the full count. Every
 * suite that samples uses a fixed seed or a fixed stride, so a failure always comes back.
 */
export const FULL = process.env.FULL === '1'

/** `full` with FULL=1, else `quick`. */
export const count = (full: number, quick: number) => (FULL ? full : quick)

/** All of `items` with FULL=1, else every `stride`-th one (the first always in): the same ones every run. */
export function sample<T>(items: readonly T[], stride: number): readonly T[] {
  return FULL ? items : items.filter((_, i) => i % stride === 0)
}
