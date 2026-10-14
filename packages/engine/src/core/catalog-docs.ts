/**
 * The catalog's documentation half (E-2): the reserved rows, and every row's `definition` and
 * `retired` names. Tests and docs read it; the app never imports it, so the first download
 * carries only the lean catalog (catalog.ts). Same rules as catalog.ts: never rename or delete an
 * ID, only add. test/catalog.test.ts checks that the two files cover the same IDs.
 */
import { SIGNALS, type RunEventId, type ReservedSignalId, type SignalId, type SignalMeta } from './catalog.ts'
import { BREATHING_SIGNALS } from './catalog/breathing.ts'
import { EFFORT_SIGNALS } from './catalog/effort.ts'
import { CIRCULATION_SIGNALS } from './catalog/circulation.ts'
import { KIDNEY_SIGNALS } from './catalog/kidneys.ts'

/** What a row means and which old names it replaces. */
export interface CatalogDocs {
  /** One precise English sentence: what quantity, measured how. Shown to reviewers, used in docs. */
  definition: string
  /** Old plan names this ID replaces. Never use them in code (retired-names.test.ts). */
  retired: readonly string[]
}

const k = (id: string) => `signals.${id}`

/** Reserved names (do NOT emit yet). sourceIds are filled when the bundle ships. */
export const RESERVED_SIGNALS: { readonly [Id in ReservedSignalId]: SignalMeta<Id> } = {
  'gut.stomach.outflowRate': {
    id: 'gut.stomach.outflowRate',
    unit: 'kcal/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.stomach.outflowRate'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
  },
  'blood.insulin': {
    id: 'blood.insulin',
    unit: 'xFasting',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: [],
    i18nKey: k('blood.insulin'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
  },
  'liver.glucoseOutput': {
    id: 'liver.glucoseOutput',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('liver.glucoseOutput'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
  },
  'liver.glycogenG': {
    id: 'liver.glycogenG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: [],
    i18nKey: k('liver.glycogenG'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
  },
  'brain.glucoseUse': {
    id: 'brain.glucoseUse',
    unit: 'g/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('brain.glucoseUse'),
    reactsToMeal: false,
    shipsIn: 'bloodSugar',
  },
}

/** Definition and retired names of every signal row (active, pack and reserved). */
export const SIGNAL_DOCS: { readonly [Id in SignalId]: CatalogDocs } = {
  'gut.stomach.contentG': {
    definition: 'Grams of the meal still in the stomach, counted as food and drink as eaten (liquid + solid).',
    retired: ['stomach.share', 'gut.stomach.fill', 'gut.stomach.contents', 'stomach.contentsG'],
  },
  'gut.stomach.liquidG': {
    definition: 'Grams of the drinks in the meal still in the stomach.',
    retired: ['stomach.liquidG'],
  },
  'gut.stomach.solidG': {
    definition: 'Grams of the solid foods in the meal still in the stomach.',
    retired: ['stomach.solidG'],
  },
  'gut.small.contentG': {
    definition: 'Grams of tracked nutrients (carbohydrate, protein, fat, fibre, water) from the meal in the small intestine.',
    retired: ['gut.smallIntestineG', 'si.contentsG', 'gut.si.contentG'],
  },
  'gut.colon.contentG': {
    definition: 'Grams of tracked nutrients from the meal in the large intestine (colon).',
    retired: ['gut.colonG', 'colon.contentsG'],
  },
  'gut.absorbed.carbsG': {
    definition: 'Running total of digestible carbohydrate (not fibre) from the meal absorbed into the body.',
    retired: ['absorbed.carbs'],
  },
  'gut.absorbed.proteinG': {
    definition: 'Running total of protein from the meal absorbed into the body.',
    retired: ['absorbed.protein'],
  },
  'gut.absorbed.fatG': {
    definition: 'Running total of fat from the meal absorbed into the body (blood and lymph).',
    retired: ['absorbed.fat'],
  },
  'gut.absorbed.waterG': {
    definition: 'Running total of water from the meal absorbed in the small and large intestine.',
    retired: ['absorbed.water', 'water.absorbed.total'],
  },
  'gut.absorbed.fibreG': {
    definition: 'Running total of fibre absorbed. Always 0 in this model: the body cannot digest fibre.',
    retired: ['absorbed.fibre', 'absorbed.fiber'],
  },
  'gut.leftBodyG': {
    definition: 'Running total of tracked nutrients from the meal that have left the body (mostly fibre and water).',
    retired: ['body.leftG', 'gut.excretedG', 'gut.location.leftBody'],
  },
  'blood.glucose': {
    definition:
      'Plasma glucose of the typical healthy adult, absolute (fasting ≈ 90 mg/dL). The rise above fasting is a helper, not an ID.',
    retired: ['glucose.plasma', 'blood.glucoseRise', 'blood.glucose.riseAboveFasting'],
  },
  'energy.inRate': {
    definition:
      'Food energy entering the body per hour: 4·carbohydrate + 4·protein + 9·fat (kcal/g, Atwater) of the grams absorbed in that hour. Fibre left out.',
    retired: ['energy.in.rate'], // note: earlier plans used kcal/min under this same ID; the unit is kcal/h, frozen
  },
  'energy.inTotal': {
    definition: 'Running total of energy.inRate: kcal from this meal that have entered the body so far.',
    retired: ['energy.inCum', 'energy.in.total', 'energy.inKcal'],
  },
  'energy.usedRate': {
    definition:
      "Resting energy use of the run's profile per hour: Schofield BMR (FAO/WHO/UNU 2004) with the ICMR-NIN 2020 Indian adjustment, ÷ 24. Does not depend on the meal.",
    retired: ['energy.used.rate'],
  },
  'energy.usedTotal': {
    definition: 'Running total of energy.usedRate since the meal started.',
    retired: ['energy.usedCum', 'energy.used.total', 'energy.usedKcal'],
  },
  'gut.stomach.outflowRate': {
    definition: 'Food energy leaving the stomach through the pylorus per minute.',
    retired: ['outflow'],
  },
  'gut.absorbRate.carbs': {
    definition: 'Grams of carbohydrate absorbed per minute.',
    retired: ['gut.si.absorbRate.carbs', 'gut.carbAbsorbRate', 'liver.portalCarbInflow'],
  },
  'gut.absorbRate.protein': {
    definition: 'Grams of protein absorbed per minute.',
    retired: ['gut.si.absorbRate.protein'],
  },
  'gut.absorbRate.fat': {
    definition: 'Grams of fat absorbed per minute.',
    retired: ['gut.si.absorbRate.fat'],
  },
  'gut.absorbRate.water': {
    definition: 'Grams of water absorbed per minute (small + large intestine).',
    retired: ['gut.si.absorbRate.water'],
  },
  'energy.activityRate': {
    definition:
      'Energy used per hour by moving, above resting use: (MET − 1)·3.5·kg/200 kcal/min × 60, with the 2024 Compendium MET of the bout (net MET, model D3). 0 at rest.',
    retired: ['activity.kcalRate', 'energy.activity.rate'],
  },
  'energy.activityTotal': {
    definition: 'Running total of energy.activityRate since the meal started.',
    retired: ['activity.kcalTotal', 'energy.activity.total'],
  },
  'energy.foodEffectRate': {
    definition:
      'Energy used per hour to digest and store the meal (thermic effect of food): shares of the absorbed carbohydrate, protein and fat energy (Westerterp 2004), through a first-order lag.',
    retired: ['energy.tef', 'energy.dit'],
  },
  // ── The effort pack (core/catalog/effort.ts; S-1, model §2.7, §2.9) ──
  'muscle.energyRate': {
    definition:
      'Energy used per hour by the skeletal muscles: resting muscle (13 kcal/kg/day, Elia 1992, × 38.4 % of body mass, Janssen 2000) plus all of energy.activityRate.',
    retired: [],
  },
  'skin.sweatRate': {
    definition:
      'Sweat made per hour, in mL: in a warm room the extra heat of moving (energy.activityRate) leaves as evaporated sweat, 580 kcal per kg (Baker 2019). 0 at rest.',
    retired: [],
  },
  'skin.sweatTotal': {
    definition: 'Running total of skin.sweatRate since the meal started, in mL.',
    retired: [],
  },
  'blood.insulin': {
    definition: "Plasma insulin as a multiple of the fasting level. NOT today's lagged 'insulin action' term in glucose.ts.",
    retired: ['insulin.relative', 'insulin.action', 'pancreas.insulinAction', 'pancreas.insulinSecretion'],
  },
  'liver.glucoseOutput': {
    definition: 'Net glucose the liver releases into the blood per minute (+ release, − taking up and storing).',
    retired: [],
  },
  'liver.glycogenG': {
    definition: 'Grams of glycogen stored in the liver.',
    retired: ['glycogen.liver'],
  },
  'brain.glucoseUse': {
    definition: 'Glucose the brain uses per hour (cited constant; does not react to the meal).',
    retired: ['brain.glucoseUseGPerH'],
  },
  // The circulation pack's rows (core/catalog/circulation.ts, S-3). heart.rate was reserved as a
  // real-clock beat; it activated as a graphed sim-clock level with its unit kept (ACTIVATION_LOG).
  'heart.rate': {
    definition:
      'Heart beats a minute: heart.output divided by heart.strokeVolume (66 at rest), at most 191 (220 − age). Graphed; the drawn beat follows it.',
    retired: ['heart.rateBpm', 'vitals.heartRate', 'rhythm.heart'],
  },
  'heart.output': {
    definition:
      'Blood the heart pumps a minute (cardiac output, L/min): resting O2 use over a 50 mL/L a–v O2 difference, plus 5.5 L per L of extra O2 used by moving, plus the gut’s extra flow after a meal.',
    retired: [],
  },
  'heart.strokeVolume': {
    definition: 'Blood pumped per beat (mL): 65 at rest, rising with the moving part of heart.output up to 1.4×, then flat.',
    retired: [],
  },
  'blood.flow.gut': {
    definition:
      'Blood flowing through the gut a minute (mL/min): 24 % of resting heart.output, plus a rise that grows with the absorbed energy (fat and protein count fully, carbohydrate 0.6).',
    retired: [],
  },
  'blood.flow.muscle': {
    definition: 'Blood flowing through the skeletal muscles a minute (mL/min): 21 % of resting heart.output plus 90 % of the moving rise.',
    retired: [],
  },
  // The breathing pack's rows (core/catalog/breathing.ts, S-2). lungs.breathRate was reserved as a
  // real-clock rhythm; it activated as a sim-clock level with its unit kept (ACTIVATION_LOG).
  'gas.o2UseRate': {
    definition: 'Oxygen the whole body uses per minute (mL/min, dry gas at 0 °C), from the energy used through Weir’s equation.',
    retired: ['body.oxygenUse', 'lungs.oxygenUse', 'gas.vo2'],
  },
  'gas.co2OutRate': {
    definition: 'Carbon dioxide the whole body makes and breathes out per minute (mL/min): the exchange ratio times the oxygen used.',
    retired: ['gas.vco2', 'lungs.co2Out'],
  },
  'gas.exchangeRatio': {
    definition: 'Carbon dioxide made per oxygen used (RQ), steady state: higher when more carbohydrate is burned, lower with more fat.',
    retired: ['gas.rq', 'body.rq'],
  },
  'lungs.breathRate': {
    definition:
      'Breaths a minute, from the alveolar air needed to carry the carbon dioxide away (15 at rest). Graphed; the drawn breath follows it.',
    retired: ['lungs.breathsPerMin', 'vitals.breathRate', 'rhythm.breath'],
  },
  'lungs.tidalVolume': {
    definition: 'Air per breath (mL): the alveolar air per breath plus 150 mL of airway dead space, at most 2.5 L.',
    retired: ['lungs.vt', 'lungs.breathDepth'],
  },
  // The kidneys pack's rows (core/catalog/kidneys.ts, S-4). kidney.filtrationRate was reserved as a
  // real-clock illustration; it activated as a sim-clock constant with its unit kept (ACTIVATION_LOG).
  'kidney.urineRate': {
    definition:
      'Urine made per hour (mL/h): a steady background of 1.5 L a day plus the extra water from the meal, sent out after an ADH lag, between 500 mL a day and 750 mL an hour.',
    retired: ['kidney.urineMlPerH', 'urine.rate'],
  },
  'kidney.urineTotal': {
    definition: 'Running total of kidney.urineRate since the meal started, in mL (background included).',
    retired: ['kidney.urineMl'],
  },
  'kidney.bladderMl': {
    definition: 'Urine in the bladder (mL): starts empty, fills with kidney.urineRate and empties at 300 mL (Model estimate).',
    retired: ['bladder.volumeMl'],
  },
  'water.mealExtraMl': {
    definition:
      'Water from this meal still in the body (mL): water absorbed plus extra metabolic water, minus extra urine and sweat. Below 0 when sweat took more than the meal gave.',
    retired: ['water.balanceMl'],
  },
  'kidney.filtrationRate': {
    definition:
      'Plasma filtered by both kidneys per minute (GFR), 125 mL/min, the same all day here. Caption and table only, never graphed.',
    retired: ['kidney.gfr', 'kidney.filtrationMlMin'],
  },
}

/** Definition and retired names of every event row. */
export const EVENT_DOCS: { readonly [Id in RunEventId]: CatalogDocs } = {
  'event.stomachHalfEmpty': {
    // By energy on purpose: adding water to a meal never makes it look faster (a drink with
    // calories can, a little: its energy leaves first). So on a grams strip the half-way point in
    // grams can come before this marker (the drink's grams leave first).
    definition: "First minute when half of the meal's food energy (for energy-free drinks: half its weight) has left the stomach.",
    retired: ['events.stomachHalfEmpty', 'events.half'],
  },
  'event.glucosePeak': {
    definition: 'Minute when typical blood glucose is highest. Absent if the rise is under 1 mg/dL.',
    retired: ['events.glucosePeak', 'events.peak'],
  },
  'event.glucoseBackToBase': {
    definition:
      'First minute after the peak when typical blood glucose is within PARAMS.glucose.backToBaseMgDl (5) of fasting. The threshold is a display choice, not physiology.',
    retired: ['events.backToBaseline'],
  },
  'event.mostlyAbsorbed': {
    definition: '90 % of the carbohydrate, protein and fat that will be absorbed is in the body. Absent if the meal has < 0.5 g of them.',
    retired: ['events.mostlyAbsorbed', 'events.absorbed'],
  },
  'event.firstLeftovers': {
    definition:
      'Leftovers (fibre the body cannot digest) start leaving the body. Typical value plus a low–high range that depends mostly on the person. Absent if < 1 g fibre.',
    retired: ['events.firstExit', 'events.exit'],
  },
  'event.activityStart': {
    definition: 'Minute the first activity bout of the plan starts. Absent when the person only rests.',
    retired: [],
  },
  'event.activityEnd': {
    definition: 'Minute the last activity bout of the plan ends. Absent when the person only rests.',
    retired: [],
  },
  // The circulation pack's event (lazy row, core/catalog/circulation.ts).
  'event.gutFlowPeak': {
    definition: 'First minute when blood.flow.gut is highest. Absent if it rises by less than 10 mL/min (water, a fasting rest).',
    retired: [],
  },
  // The kidneys pack's moments (core/catalog/kidneys.ts, S-4).
  'event.bladderFirstUrge': {
    definition:
      'First minute the bladder holds 150 mL, when the urge to pass urine is first felt (it can wait). Comes on every run, meal or not.',
    retired: [],
  },
  'event.mostMealWaterPassed': {
    definition:
      "First minute when half of the meal's absorbed water has left as extra urine. Absent when the meal has under 1 mL of water, or sweat keeps it from happening within 48 h.",
    retired: ['event.firstVoid'],
  },
}

/** Every signal row: active, the packs' lazy rows, and reserved (tests and docs). */
export const ALL_SIGNALS: { readonly [Id in SignalId]: SignalMeta<Id> } = {
  ...SIGNALS,
  ...BREATHING_SIGNALS,
  ...EFFORT_SIGNALS,
  ...KIDNEY_SIGNALS,
  ...CIRCULATION_SIGNALS,
  ...RESERVED_SIGNALS,
}
