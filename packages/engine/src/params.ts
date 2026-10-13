/**
 * Every tunable number in the model lives here, next to where it comes from.
 * Changing any value = bump MODEL_VERSION and update the golden tests.
 * Full references and a glossary: docs/MODEL.md
 */

import type { OrganismId } from './core/organism.ts'

/** Bumped whenever outputs change for the same input. Stored in share links as `v=`. */
export const MODEL_VERSION = 2

export const PARAMS = {
  eating: {
    /** Illustrative eating pace for solids (g/min). Modelling assumption, not a measured constant. */
    solidGramsPerMin: 35,
    minSolidMin: 2,
    maxMin: 20,
    /** Drinking a glass/can takes about a minute. Modelling assumption. */
    liquidMin: 1,
  },

  esophagus: {
    /** A swallow reaches the stomach in about 4–8 s for solids, ~1 s for liquids (OpenStax A&P 2e §23.3). */
    transitMin: 6 / 60,
  },

  stomach: {
    /** Water empties exponentially: mean half-time ~16 min, upper normal 22 min (Ziessman et al. 2009). */
    waterHalfTimeMin: 16,
    /**
     * Energy-regulated emptying: the duodenum lets through a roughly constant number of kcal per
     * minute — 2.13 kcal/min measured for glucose drinks (Brener et al. 1983). Fat, protein and
     * carbohydrate slow emptying equally per kcal (Hunt & Stubbs 1975).
     */
    energyKcalPerMin: 2.13,
    /**
     * Solid meals empty more slowly per kcal than sugary drinks. Calibrated so the consensus
     * 255 kcal test meal sits mid-range in the scintigraphy norms (Abell et al. 2008: 1 h 37–90 %,
     * 2 h 30–60 %, 4 h ≤ 10 % left), which implies ~1.4 kcal/min.
     */
    solidKcalPerMin: 1.4,
    /**
     * Solids must be ground small before they can leave. Siegel et al. 1988 measured a lag of
     * 31 ± 8 min (egg meal) by intercept; we ramp the emptying rate up over twice the lag, which
     * gives the same intercept. 20 min keeps early glucose rises close to meal-test data.
     */
    solidLagMin: 20,
  },

  /**
   * Largest meal the model is meant for. Emptying data come from meals up to roughly this size
   * (Hunt & Stubbs 1975 pooled meals up to ~1250 mL); above it the stomach stretches and the
   * model is not reliable, so the app warns and won't let you add more.
   */
  maxMealKcal: 1500,

  /** Fraction of each nutrient absorbed by the end of the small intestine (OpenStax §23.7). */
  absorbedInSmallIntestine: {
    carbs: 0.95,
    protein: 0.9,
    fat: 0.95,
    water: 0.8,
    fiber: 0,
  },
  /**
   * How quickly each nutrient is absorbed once it is in the small intestine (first-order time
   * constant, minutes). Sugars go fastest, mostly in the first part (jejunum); fat is slowest
   * and needs bile, so much of it is absorbed further down (OpenStax §23.7). Carbs' value is
   * calibrated together with the glucose curve; the others are modelling assumptions.
   */
  absorptionTauMin: {
    carbs: 10,
    protein: 40,
    fat: 60,
    water: 20,
    fiber: 1,
  },
  /** Fraction of the water reaching the colon that the colon absorbs, and how gradually. */
  colonWaterAbsorbed: 0.9,
  colonWaterTauMin: 300,

  smallIntestine: {
    /**
     * Small-bowel transit: 3–5 h (OpenStax A&P 2e §23.5); capsule-study reference range
     * 3.3–5.7 h (Nandhra et al. 2023).
     */
    typicalMin: 4 * 60,
    lowMin: 3 * 60,
    highMin: 5.7 * 60,
  },

  colon: {
    /**
     * Colonic transit: typically 12–24 h (OpenStax §23.5); capsule-study means 16–29 h
     * (Nandhra et al. 2023). Women average a few hours longer than men (Wang et al. 2015).
     */
    typicalMin: 22 * 60,
    lowMin: 12 * 60,
    highMin: 29 * 60,
  },

  /** Less than this many grams of fibre reaching the colon counts as "almost nothing left over". */
  residueThresholdG: 1,

  energy: {
    /**
     * Atwater general factors, kcal per gram: 4.0 protein, 9.0 fat, 4.0 carbohydrate (FAO 2003,
     * Food and Nutrition Paper 77, §3.5.1). Applied to the absorbed grams for energy.inRate.
     * Fibre's energy (gut bacteria ferment some of it) is left out.
     */
    atwaterKcalPerG: {
      carbs: 4,
      protein: 4,
      fat: 9,
    },
  },

  glucose: {
    /** Typical fasting glucose: CGM mean 89 mg/dL in healthy adults (Freckmann et al. 2007). */
    fastingMgDl: 90,
    /** Baseline (insulin-independent) return toward fasting. */
    clearanceTauMin: 40,
    /**
     * Insulin action builds up while glucose is raised and then pulls it back down, so blood
     * glucose peaks and returns even while the gut is still absorbing. Structure follows the
     * Bergman minimal model (Bergman et al. 1979); constants are calibrated, not measured. A long
     * time constant makes insulin action keep building while glucose is high, so even a slow,
     * steady meal brings glucose back towards normal instead of leaving a plateau.
     */
    insulinTauMin: 300,
    insulinGain: 0.0001,
    /** Calibrated so 50 g glucose in water peaks ~+50 mg/dL at ~30–60 min (see golden tests). */
    gainMgDlPerG: 8,
    /**
     * Fat and protein blunt the glucose rise of a mixed meal; GI values are not additive.
     * Gram for gram protein blunts about twice as much as fat (Moghaddam et al. 2006).
     * Modelled as 1 / (1 + k · (2·protein + fat)/carbs), floored. k is calibrated.
     */
    bluntingK: 0.15,
    bluntingFloor: 0.6,
    /**
     * A food's GI is measured on the whole food, so it already includes how slowly that food
     * leaves the stomach. Our emptying model slows solids too, which would count that effect
     * twice. This factor undoes it, calibrated so simulated white bread (GI 75) gives 75 % of the
     * 2-hour glucose area of 50 g glucose — the definition of GI (Brouns et al. 2005).
     */
    solidGlycemicCorrection: 2.12,
    /** Between-person spread shown as a band (glycemic responses vary ~20–40 % between people). */
    bandLow: 0.65,
    bandHigh: 1.45,
    /**
     * "Back to before-meal level" = typical glucose within this many mg/dL of fasting
     * (event.glucoseBackToBase). A DISPLAY threshold, not physiology: it only decides where the
     * marker is drawn and changes no curve. Context only: after a meal, glucose is back to
     * preprandial levels in about 2–3 h (American Diabetes Association 2001).
     */
    backToBaseMgDl: 5,
  },

  /**
   * Simulated window: 48 h at 1-minute resolution. The run carries both (`run.horizonMin`,
   * `run.stepMin`); share links clamp `t` to this.
   */
  horizonMin: 48 * 60,
  stepMin: 1,
} as const

/** Same shape as PARAMS, with plain `number`s instead of the literal values. */
type Widen<T> = T extends number ? number : { readonly [K in keyof T]: Widen<T[K]> }

/**
 * The shape of the human parameter set. Model modules take one of these as an argument (the
 * `ctx.params` rule) instead of reading PARAMS, so a test or a later organism can pass its own
 * numbers. PARAMS stays the human set.
 */
export type Params = Widen<typeof PARAMS>

/**
 * Each organism's parameter set, for the screen's display thresholds (the graphs' "back near the
 * before-meal level"), read without loading the engine (E-2: HUMAN_MODEL, which also holds the
 * modules, is in the lazy `@lifepeek/engine/run` entry). The run uses the same object.
 */
export const ORGANISM_PARAMS: { readonly [O in OrganismId]: Params } = { human: PARAMS }
