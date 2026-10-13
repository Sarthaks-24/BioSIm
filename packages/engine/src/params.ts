/**
 * Every tunable number in the model lives here, next to where it comes from.
 * Changing any value = bump MODEL_VERSION and update the golden tests.
 * Full references and a glossary: docs/MODEL.md
 */

import type { OrganismId } from './core/organism.ts'

/** Bumped whenever outputs change for the same input. Stored in share links as `v=`. */
export const MODEL_VERSION = 3

/**
 * Whether MODEL_VERSION is final (MODEL D12). Version 3 is built over several steps (E-3a water and
 * absorbed fractions, E-3b activity, S-1…S-4) and is sealed only after all of them: until then its
 * numbers may still move, so no production deploy may carry it. apps/web/scripts/model-seal.mjs
 * fails a production build (and the release gate) while this is false. After the seal, any change
 * to an existing output is a new version.
 */
export const MODEL_SEALED = false

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

  /**
   * Fraction of each nutrient absorbed by the end of the small intestine (model version 3).
   * OpenStax A&P 2e §23.7: "About 90 percent of this water is absorbed in the small intestine";
   * protein "95 to 98 percent" (the low end is used); "About 95 percent of lipids"; carbohydrate
   * "all normally digested", so the mixed-diet coefficient 97 % of USDA Agriculture Handbook No. 74
   * (Merrill & Watt 1955, p. 9) is used. Indigestible fibre is not absorbed.
   */
  absorbedInSmallIntestine: {
    carbs: 0.97,
    protein: 0.95,
    fat: 0.95,
    water: 0.9,
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
    /**
     * The food effect (thermic effect of food, model §2.1): digesting and storing what was absorbed
     * costs energy. Share of each absorbed nutrient's Atwater energy, the middle of Westerterp
     * 2004's "0 to 3% for fat, 5 to 10% for carbohydrate, 20 to 30% for protein". It reaches the
     * body's energy use through a first-order lag. tauMin is calibrated on the consensus test meal
     * (Abell 2008, 255 kcal): 59 % of its 6 h effect comes in the first 3 h (Reed & Hill 1996:
     * 60 %). The plan's first guess, 60 min, gave 44 %: the gut model already spreads absorption
     * over ~3 h, so little lag is left for the body (E-3b-eng calibration, docs/MODEL.md).
     */
    foodEffect: {
      carbs: 0.075,
      protein: 0.25,
      fat: 0.02,
      tauMin: 20,
    },
  },

  /**
   * Activity (model §2.1, D3). A MET is an activity's energy cost as a multiple of 3.5 mL O2 per kg
   * per minute, and 1 L O2 ≈ 5 kcal, so kcal/min = MET·3.5·kg/200 (2024 Adult Compendium,
   * Herrmann 2024 and pacompendium.com "Unit conversions"). The model keeps the person's own resting
   * use (energy.usedRate) and adds only the cost above rest, (MET − 1)·3.5·kg/200 (net MET, ACSM):
   * MET 1 is exactly rest. METs are the 2024 Compendium rows of core/activity.ts.
   */
  activity: {
    restO2MlPerKgMin: 3.5,
    kcalPerLO2: 5,
    met: {
      walk: 3.8,
      walkBrisk: 4.8,
      run: 9.3,
      sitClass: 1.8,
      football: 7.0,
      cricket: 4.8,
      badminton: 5.5,
    },
  },

  /**
   * Breathing (model §2.2, S-2; sources read in V-2). Oxygen used and carbon dioxide made come from
   * the energy used (x.energy.total) through Weir's equation without protein, kcal = (3.941 +
   * 1.106·RQ) per L O2 (Kaiyala 2019, Eq 1). RQ starts at the fasting value, rises with blood
   * glucose (kRQ, calibrated on Gribok 2016's carbohydrate shake), and in a bout never falls below
   * a floor that grows with MET (more carbohydrate burned at higher effort; a calibration, R51).
   * Breathing carries the CO2 away with alveolar CO2 held at 40 mm Hg (OpenStax §22.4), so alveolar
   * air VA = 0.863·VCO2/40 L/min (0.863 = 760·310/273/1000, the gas-law constant from mL/min dry at
   * 0 °C to L/min at body temperature). The split of VA into breaths and depth is hand-picked: rate
   * f = 15·(VA/VA_rest)^(1/3) (15/min at rest, inside OpenStax's 12–18 and the book's 15–18), depth
   * VT = VA/f + 150 mL of dead space, at most 2.5 L.
   */
  gas: {
    weirO2: 3.941,
    weirCo2: 1.106,
    rqFasting: 0.82,
    rqPerMgDl: 0.0025,
    rqFloorBase: 0.8,
    rqFloorPerMet: 0.0127,
    rqMin: 0.7,
    rqMax: 1,
    alveolarCo2MmHg: 40,
    alveolarK: 0.863,
    restBreathsPerMin: 15,
    breathRateExponent: 1 / 3,
    deadSpaceMl: 150,
    tidalMaxMl: 2500,
  },

  /**
   * Effort: muscles and skin (model §2.7, §2.9; S-1). Resting skeletal muscle uses 13 kcal per kg
   * per day (Elia 1992, via Wang 2012) and is 38.4 % of a man's body mass (Janssen 2000, MRI), so
   * 13 × 0.384 × 65 kg = 325 kcal/day, 21.6 % of the reference man's resting use; all of the
   * activity extra goes to muscle. In a warm room the extra heat of moving leaves as evaporated
   * sweat, 580 kcal per kg (Baker 2019): 0.58 kcal per mL. At rest heat leaves by radiation,
   * convection, conduction and evaporation, "about" 60/15/3/20 % (OpenStax A&P 2e §24.6; the four
   * add up to 98 %, so they are used as shares of their sum). In moving, the dry routes keep their
   * resting values and sweat carries the rest (the warm-room assumption).
   */
  effort: {
    muscleKcalPerKgDay: 13,
    muscleMassShare: 0.384,
    sweatKcalPerMl: 0.58,
    restHeatLoss: {
      radiation: 60,
      convection: 15,
      conduction: 3,
      evaporation: 20,
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
