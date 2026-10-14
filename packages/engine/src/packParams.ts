/**
 * Pack parameters (R75 (1), R71/R74 load on demand): the numbers only a system pack's module uses.
 * The run chunk imports this file (simulate.ts adds it to the human run's params); the main entry
 * never does, so these numbers stay out of the first download. Same rules as params.ts: every
 * number has a PARAM_SOURCES line (core/sources.ts), and changing one changes outputs.
 */
import type { Widen } from './params.ts'

export const PACK_PARAMS = {
  /**
   * Heart and blood flow (model §2.3, D7, D8; S-3; sources read in V-3). Resting cardiac output is
   * the resting O2 use at the fasting RQ over a resting a–v O2 difference of 50 mL per L (Klabunde's
   * worked example; Higginbotham 1986 measured 58 at rest: a calibration that keeps CO 4.3 L/min,
   * inside OpenStax's 4–8, R49). Moving adds 5.5 L/min of blood per L/min of extra O2 (Stringer
   * 2005 "approximately 5-6"; Cook 2005 5.8). Digesting adds the gut's extra flow, a saturating
   * function of the absorbed energy weighted fat 1, protein 1, carbohydrate 0.6 (Sieber 1992: fat
   * and protein alike, carbohydrate "significantly less"; 0.6 is a calibration, V-3), with the rise
   * at most 3 L/min (about Sidery 1994's largest, 3.15) and K fitted so a 1526 kcal mixed meal
   * raises CO by 1.3 L/min (Eriksen 1994). The food effect's O2 is not counted again (D7): the
   * wider extraction of the gut covers it. Stroke volume rises with the moving part of CO up to
   * 1.4× at 5 L/min, then stays (Higginbotham 1986, R50); heart rate = CO / SV, at most
   * 220 − 29 = 191 (OpenStax §19.4). Muscle and gut take 21 % and 24 % of resting CO, and muscle
   * 90 % of the moving rise (OpenStax Table 20.3).
   */
  circulation: {
    restAvdo2MlPerL: 50,
    coSlopeLPerLO2: 5.5,
    svRestMl: 65,
    svRiseMax: 0.4,
    svRiseAtCoLPerMin: 5,
    hrMax: 191,
    gutRestShare: 0.24,
    muscleRestShare: 0.21,
    muscleShareOfRise: 0.9,
    gutWeight: {
      carbs: 0.6,
      protein: 1,
      fat: 1,
    },
    gutRiseMaxLPerMin: 3,
    gutHalfKcalPerMin: 2.5,
    /** event.gutFlowPeak only when gut flow rises at least this much (mL/min): a display choice. */
    gutPeakMinRiseMlPerMin: 10,
  },
} as const

/** The pack half of a run's parameter set (params.ts `Params` = the core half & this). */
export type PackParams = Widen<typeof PACK_PARAMS>
