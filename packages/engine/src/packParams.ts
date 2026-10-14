/**
 * Pack parameters (R75 (1), R77, R78; R71/R74 load on demand): the numbers only a system pack's
 * module uses (breathing, effort, water and kidneys, heart and blood, lymph; P-1 moved the first three here
 * from params.ts). The run chunk imports this file (simulate.ts adds it to the human run's params);
 * the main entry never does, so these numbers stay out of the first download (check-budget.mjs's
 * guard looks for a few of their names in /sim). Same rules as params.ts: every
 * number has a PARAM_SOURCES line (core/sources.ts), and changing one changes outputs.
 */
import type { Widen } from './params.ts'

export const PACK_PARAMS = {
  /**
   * How fast the body follows a change of activity (R82; model §2.1). The MET every module reads
   * moves towards the bout's MET as a first-order lag, faster on the way up than on the way down:
   * oxygen-uptake phase II time constants in moderate exercise, 35 ± 14 s at the start and
   * 50 ± 13 s at the end (Rossiter 2002; Poole & Jones 2012 review the kinetics). The energy the
   * lag holds back at the start is used after the bout ends (the fast part of the oxygen debt);
   * the slow part (EPOC) is a stated limit.
   */
  kinetics: {
    metTauOnS: 35,
    metTauOffS: 50,
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

  /**
   * Water and kidneys (model §2.4, D17; S-4). The run sits on a steady background day: the usual
   * drinks balance the usual 1.5 L of urine a day (OpenStax A&P 2e §26.2) and the unnoticed losses,
   * so only the body water above that day, E, moves (Model estimate). Extra metabolic water = 0.12 mL
   * per kcal above rest (IOM 2005 p85: 15, 10.5, 11.1 g per 100 kcal of carbohydrate, protein,
   * fat). The kidney follows E through an ADH lag S (dS/dt = (E − S)/τ; τ 10 min = AVP half-life
   * 6.9 min, inside Calvi 2024's 5–20 min) and sends out urine U = U0 + kx·S, between the least
   * urine, 21 mL/h (about 500 mL/day, §25.1), and 750 mL/h (inside IOM p74's 0.7–1.0 L/h). kx and τ are
   * calibrated on Maughan 2016 (1 L water: 1337 ± 330 mL urine in 4 h; the model gives ~1150 mL,
   * capped by the 0.9 L the gut has absorbed by then) with kx·τ = 0.3, about critically damped, so
   * urine never dips below the background after a drink; Crowe 1987 is the hold-out. The bladder
   * starts empty, the urge is felt at 150 mL (§25.2) and it empties at 300 mL (hand-picked inside
   * §25.2's "300 to 400 mL"). Filtration is a constant 125 mL/min (§25.5). Always well watered
   * (R81): sweat is drunk back over the background day with a 90 min lag (an assumption), and below
   * normal the kidney's gain is a fifth of kx (calibrated so a 20-min walk keeps urine above 21 mL/h).
   */
  water: {
    metabolicMlPerKcal: 0.12,
    backgroundUrineMlPerDay: 1500,
    minUrineMlPerH: 21,
    maxUrineMlPerH: 750,
    adhTauMin: 10,
    urinePerExtraMlPerMin: 0.03,
    urinePerDeficitMlPerMin: 0.006,
    sweatDrinkBackTauMin: 90,
    bladderUrgeMl: 150,
    bladderEmptyMl: 300,
    filtrationMlPerMin: 125,
  },

  /**
   * Heart and blood flow (model §2.3, D7, D8; S-3, FIX-S; sources read in V-3 and V-FIXS). Resting
   * cardiac output is the resting O2 use at the fasting RQ over a resting a–v O2 difference of 50 mL
   * per L (Klabunde's worked example; Higginbotham 1986 measured 58 at rest: a calibration that
   * keeps CO 4.3 L/min, inside OpenStax's 4–8, R49). Moving adds 5.5 L/min of blood per L/min of
   * extra O2 (Stringer 2005 "approximately 5-6"; Cook 2005 5.8). Digesting adds the gut's extra
   * flow (R80): it follows the food still being digested, the meal's absorbable energy eaten but not
   * yet absorbed, weighted fat 1, protein 1, carbohydrate 0.6 (Sieber 1992: fat and protein alike,
   * carbohydrate "significantly less"; 0.6 is a calibration, V-3). A big meal holds more food in the
   * gut for longer, so it raises CO more and for longer than a small drink (Waaler 1991). The rise
   * builds up through a 20 min lag (a calibration: "a maximum level 30 to 60 min after end of the
   * meal", Waaler 1991), saturates at 3 L/min (about Sidery 1994's largest, 3.15) with K fitted so
   * a 1526 kcal mixed meal raises CO by 1.3 L/min (Eriksen 1994). The food effect's O2 is not
   * counted again (D7). Heart rate carries 27 % of the meal's rise (in logs) and stroke volume the
   * rest (Kelbaek 1989: stroke volume +23 %, heart rate +8 % half an hour after a meal). In a bout
   * stroke volume rises with the moving part of CO up to 1.4× at 5 L/min, then stays (Higginbotham
   * 1986, R50); heart rate = CO / SV, at most 220 − 29 = 191 (OpenStax §19.4). Muscle and gut take
   * 21 % and 24 % of resting CO; in a bout muscle takes 90 % of the moving rise. The gut gives up
   * blood to the muscles in proportion to how hard the heart works, the moving rise over the most
   * it can add (191 beats × 91 mL − CO_rest): at the top it keeps 600 of its 1400 mL/min (R83,
   * OpenStax Table 20.3 maximal exercise, 57 % given up); the mild column (1100 of 1400 while CO
   * rises 3700 of a possible 11 700 mL/min) is the check. CO is unchanged.
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
    gutGiveUpAtMax: 0.57,
    gutWeight: {
      carbs: 0.6,
      protein: 1,
      fat: 1,
    },
    gutRiseMaxLPerMin: 3,
    gutHalfKcal: 1370,
    gutRiseTauMin: 20,
    hrShareOfMealRise: 0.27,
    /** event.gutFlowPeak only when gut flow rises at least this much (mL/min): a display choice. */
    gutPeakMinRiseMlPerMin: 10,
  },

  /**
   * Lymph fat and blood fat (model §2.10; S-5, sources read in V-5). The fat the gut absorbs is
   * packed into chyle and carried by the lacteals and lymph to the blood (OpenStax §21.1, §23.7):
   * a first-order lag, τ_pack. In the blood it is cleared with τ_clear, one lumped pool:
   * dL/dt = (fatRate − L)/τ_pack, dP/dt = L − P/τ_clear, blood fat = 80 + P·1000/29 mg/dL. Plasma
   * 29 dL = 5.5 L of blood × 53 % plasma (OpenStax §18.1, a man); 80 mg/dL fasting = Liu 2022's
   * 0.91 mmol/L. τ_clear is calibrated (Model estimate) on the engine's own fat absorption so that
   * everyday meals of 15–30 g fat (up to 500 kcal) raise blood fat by 15–40 mg/dL, highest at 1–6 h
   * (Nordestgaard 2016: +18 to +26 mg/dL); 10 min puts them at about +18 to +33. τ_pack is
   * hand-picked: no page read gives it, and the calibration hardly sees it (20 or 45 min move those
   * rises by under 5 mg/dL and their peaks by under 0.5 h). A fat load of 50 g or more peaking at
   * 2–5 h and back within 10 mg/dL by 14 h (O'Doherty 2018) is the hold-out.
   */
  lymph: {
    packTauMin: 30,
    clearTauMin: 10,
    plasmaDl: 29,
    fastingMgDl: 80,
    /** event.triglyceridePeak only when blood fat rises at least this much (mg/dL): a display choice. */
    peakMinRiseMgDl: 1,
  },
} as const

/** The pack half of a run's parameter set (params.ts `Params` = the core half & this). */
export type PackParams = Widen<typeof PACK_PARAMS>
