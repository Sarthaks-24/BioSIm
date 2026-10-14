import { runMoments } from '../../lib/moments.ts'
import type { SystemUi } from '../registry.ts'
import { NowLine } from './NowLine.tsx'
import { stripSummary } from './stripSummary.ts'
import { compareSummary, singleSummary } from './summary.ts'

/** Digestion's words and moments: where the meal is, the stomach race, each graph in a sentence. */
export const DIGESTION_UI: SystemUi = {
  now: NowLine,
  summary: (run, kept, t, lang) => (kept ? compareSummary(run, kept, t, lang) : singleSummary(run, t, lang)),
  stripSummary,
  moments: runMoments,
}
