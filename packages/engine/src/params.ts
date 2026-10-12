/**
 * Every tunable number in the model lives here, next to where it comes from.
 * Changing any value = bump MODEL_VERSION and update the golden tests.
 * Full references: docs/MODEL.md
 */

/** Bumped whenever outputs change for the same input. Stored in share links. */
export const MODEL_VERSION = 1

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
    /** Esophageal transit of a swallowed bolus is a few seconds (~5–10 s). */
    transitMin: 8 / 60,
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
    /** Solids must be ground small before leaving: lag 31 ± 8 min for an egg meal (Siegel et al. 1988). */
    solidLagMin: 30,
    /**
     * Power-exponential shape (Elashoff et al. 1982): retention = 2^-((t/t½)^β).
     * β = 1 is a pure exponential (liquids); β > 1 gives the lag-then-linear shape of solids.
     */
    liquidBeta: 1,
    solidBeta: 1.3,
  },

  /** Fraction of each nutrient absorbed by the end of the small intestine (typical healthy adult). */
  absorbedInSmallIntestine: {
    carbs: 0.95,
    protein: 0.9,
    fat: 0.95,
    water: 0.8,
    fiber: 0,
  },
  /** Fraction of the water reaching the colon that the colon absorbs. */
  colonWaterAbsorbed: 0.9,

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

  glucose: {
    /** Typical fasting glucose: CGM mean 89 mg/dL in healthy adults (Freckmann et al. 2007). */
    fastingMgDl: 90,
    /** Time for sugar leaving the stomach to be absorbed into blood (first-order). */
    absorptionTauMin: 10,
    /** Baseline (insulin-independent) return toward fasting. */
    clearanceTauMin: 40,
    /**
     * Insulin action builds up while glucose is raised and then pulls it back down, so blood
     * glucose peaks and returns even while the gut is still absorbing. Structure follows the
     * Bergman minimal model (Bergman et al. 1979); constants are calibrated, not measured.
     */
    insulinTauMin: 25,
    insulinGain: 0.00006,
    /** Calibrated so 50 g glucose in water peaks ~+50 mg/dL at ~30–60 min (see golden tests). */
    gainMgDlPerG: 5,
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
    solidGlycemicCorrection: 1.45,
    /** Inter-person spread shown as a band (glycemic responses vary ~20–40 % between people). */
    bandLow: 0.65,
    bandHigh: 1.45,
    /** Used only when a food with carbs is missing a GI (should not happen; schema forbids ≥5 g). */
    defaultGi: 55,
  },

  /** Simulated window: 48 h at 1-minute resolution. */
  horizonMin: 48 * 60,
  stepMin: 1,
} as const

export type Params = typeof PARAMS
