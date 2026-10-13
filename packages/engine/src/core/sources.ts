/**
 * The source registry (A2): one entry per reference the model rests on. Signals, events and
 * parameters cite these IDs. docs/MODEL.md's reference list is checked against it
 * (test/catalog.test.ts), so a reference cannot be added there without an entry here.
 */

export type SourceKind = 'paper' | 'textbook' | 'dataset' | 'guideline' | 'report'
/** 'toVerify' = not yet read in full. Release gate: no ACTIVE signal may cite a 'toVerify' source. */
export type SourceCheck = 'checked' | 'toVerify'

/** A model-level reference. (Not `Source` in schema.ts, which is a citation inside one food file.) */
export interface SourceEntry {
  id: string
  citation: string
  url?: string
  kind: SourceKind
  check: SourceCheck
  /** What we use it for, in one line. */
  usedFor: string
}

export const SOURCES = {
  // ── From docs/MODEL.md (refs 1–13): already used by the engine ──
  abell2008: {
    kind: 'guideline',
    check: 'checked',
    usedFor: 'solid emptying norms at 1/2/4 h',
    citation: 'Abell TL, et al. Consensus recommendations for gastric emptying scintigraphy. Am J Gastroenterol 2008;103:753–763.',
  },
  atkinson2008: {
    kind: 'dataset',
    check: 'checked',
    usedFor: 'glycemic index values',
    url: 'https://doi.org/10.2337/dc08-1239',
    citation:
      'Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index and glycemic load values: 2008. Diabetes Care 2008;31:2281–2283.',
  },
  bergman1979: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'structure of the glucose/insulin-action term (constants calibrated)',
    citation: 'Bergman RN, et al. Quantitative estimation of insulin sensitivity. Am J Physiol 1979;236:E667–E677.',
  },
  brener1983: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'energy-regulated emptying, 2.13 kcal/min',
    citation: 'Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. Gastroenterology 1983;85:76–82.',
  },
  brouns2005: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'GI definition (2-h glucose area)',
    citation: 'Brouns F, et al. Glycaemic index methodology. Nutr Res Rev 2005;18:145–171.',
  },
  freckmann2007: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'fasting glucose ≈ 89 mg/dL; meal peak timing',
    citation: 'Freckmann G, et al. Continuous glucose profiles in healthy subjects. J Diabetes Sci Technol 2007;1:695–703.',
  },
  hunt1975: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'meal energy and volume set emptying speed',
    citation: 'Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. J Physiol 1975;245:209–225.',
  },
  moghaddam2006: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'fat and protein blunt the glucose rise',
    citation: 'Moghaddam E, Vogt JA, Wolever TMS. Effects of fat and protein on glycemic responses. J Nutr 2006;136:2506–2511.',
  },
  nandhra2023: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'small-bowel and colon transit ranges',
    citation:
      'Nandhra GK, et al. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. J Clin Med 2023;12:5272.',
  },
  'openstax-ap2e-23': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'absorbed fractions, transit, stage text',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e',
    citation: 'OpenStax. Anatomy and Physiology 2e, ch. 23. Rice University.',
  },
  siegel1988: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'solid lag phase',
    citation: 'Siegel JA, et al. Biphasic nature of gastric emptying. Gut 1988;29:85–89.',
  },
  wang2015: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'colonic transit differs by sex',
    citation: 'Wang YT, et al. Regional gastrointestinal transit and pH in 215 healthy volunteers. Aliment Pharmacol Ther 2015;42:761–772.',
  },
  ziessman2009: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'water half-emptying ~16 min',
    citation: 'Ziessman HA, et al. Liquid gastric emptying. J Nucl Med 2009;50:726–731.',
  },

  // ── New in v2.0 (WP-06 energy, WP-04 back-to-base) ──
  /** Checked 2026-10-12 (WP-06): §5.2, Table 5.2, men 18–30 y: 15.057·kg + 692.2 kcal/d. */
  faowhounu2004: {
    kind: 'report',
    check: 'checked',
    usedFor: 'Schofield BMR equations (§5.2, Table 5.2)',
    url: 'https://www.fao.org/4/y5686e/y5686e07.htm',
    citation:
      'FAO/WHO/UNU. Human energy requirements. Report of a Joint FAO/WHO/UNU Expert Consultation. FAO Food and Nutrition Technical Report Series 1. Rome, 2004.',
  },
  /**
   * Checked 2026-10-12 (WP-06) against ICMR-NIN's own brief note (nin.res.in/rdabook/brief_note.pdf):
   * Table 1b men 65.0 kg, sedentary 2110 kcal/d; sedentary PAL 1.40; adult BMR from the FAO/WHO/UNU
   * equations lowered by 5 % (2010) + 5 % (2020). The 19–39 y age range was seen only in secondary
   * reports of the 2020 book.
   */
  'icmr-nin2020': {
    kind: 'guideline',
    check: 'checked',
    usedFor: 'reference adult 65 kg, −10 % BMR for Indian adults, PAL 1.40, 2110 kcal/d',
    url: 'https://www.nin.res.in/rdabook/brief_note.pdf',
    citation:
      'ICMR-National Institute of Nutrition. Nutrient Requirements for Indians: Recommended Dietary Allowances and Estimated Average Requirements. Hyderabad, 2020.',
  },
  /**
   * Checked 2026-10-12 (WP-06): §3.5.1 "The Atwater general factor system" gives 4.0 kcal/g protein,
   * 9.0 fat, 4.0 carbohydrate, "corrected for losses in digestion, absorption and urinary excretion
   * of urea"; Atwater's carbohydrate is by difference, so includes fibre.
   */
  fao2003: {
    kind: 'report',
    check: 'checked',
    usedFor: 'Atwater general factors 4/4/9 kcal/g (§3.5.1)',
    url: 'https://www.fao.org/4/y5022e/y5022e04.htm',
    citation: 'FAO. Food energy – methods of analysis and conversion factors. FAO Food and Nutrition Paper 77. Rome, 2003.',
  },
  ada2001: {
    kind: 'guideline',
    check: 'checked',
    usedFor: 'after a meal glucose returns to preprandial in 2–3 h (context for the back-to-base marker)',
    citation: 'American Diabetes Association. Postprandial blood glucose. Diabetes Care 2001;24:775–778.',
  },
  // ── New in model version 3 (E-3a) ──
  /**
   * Checked 2026-10-14 (E-3a, scanned USDA copy): p. 9, the mixed-diet ("Total food") coefficients
   * of apparent digestibility, protein 92, fat 95, carbohydrate 97 %; Table 7 column C the same.
   * Whole-gut figures (faecal losses), so used only where OpenStax §23.7 gives no number (carbohydrate).
   */
  merrill1955: {
    kind: 'report',
    check: 'checked',
    usedFor: 'carbohydrate 97 % absorbed (mixed-diet coefficient, p. 9)',
    url: 'https://ars.usda.gov/ARSUSERFILES/80400535/DATA/CLASSICS/USDA%20HANDBOOK%2074.PDF',
    citation:
      'Merrill AL, Watt BK. Energy value of foods: basis and derivation. Agriculture Handbook No. 74. US Department of Agriculture, Washington DC, 1955.',
  },
  /**
   * Checked 2026-10-14 (E-3a): ch. 4, Table 1 "Sample blood glucose responses to the ingestion of 50g
   * carbohydrate": three standard tests in one subject peak at 30 min, +2.7–3.9 mmol/L, and are within
   * 0.6 mmol/L of fasting at 120 min. The page does not say whether that standard was glucose or white
   * bread ("Either white bread or glucose can be used as the standard food"), so it supports the shape only.
   */
  fao1998: {
    kind: 'report',
    check: 'checked',
    usedFor: 'shape of the 50 g glucose response (peak ~30 min, near fasting by 2 h)',
    url: 'https://www.fao.org/4/w8079e/w8079e0a.htm',
    citation:
      'FAO/WHO. Carbohydrates in human nutrition. Report of a Joint FAO/WHO Expert Consultation. FAO Food and Nutrition Paper 66. Rome, 1998.',
  },
  // Bundles D/E/F add theirs (ferrannini1985, taylor1996, cahill1968, fleming2011, openstax-ap2e-19/22/25…) when they ship.
} as const satisfies Record<string, Omit<SourceEntry, 'id'>>

export type RegisteredSourceId = keyof typeof SOURCES
/** `food:<foodId>` = "the cited sources inside that food file" (content/foods/<id>.json → sources[]). */
export type SourceId = RegisteredSourceId | `food:${string}`

export const isRegisteredSource = (id: string): id is RegisteredSourceId => Object.hasOwn(SOURCES, id)

/** A registered source with its ID. `food:*` IDs return undefined: the web app resolves them from the food file. */
export function sourceById(id: SourceId): SourceEntry | undefined {
  if (!isRegisteredSource(id)) return undefined
  const s: Omit<SourceEntry, 'id'> = SOURCES[id]
  return { id, ...s }
}

/** How a parameter rests on its sources. 'display' = a presentation choice, not physiology. */
export type ParamBasis = 'measured' | 'calibrated' | 'assumption' | 'display'

/**
 * A2: which parameter (dotted path into PARAMS) rests on which source, and how. The numbers stay in
 * params.ts. Every number in PARAMS has a line here (test/contract.test.ts checks it).
 * An 'assumption' may still list a source when the source gives the context but not the number.
 */
export const PARAM_SOURCES: Readonly<Partial<Record<string, { sources: readonly RegisteredSourceId[]; basis: ParamBasis }>>> = {
  'stomach.waterHalfTimeMin': { sources: ['ziessman2009'], basis: 'measured' },
  'stomach.energyKcalPerMin': { sources: ['brener1983', 'hunt1975'], basis: 'measured' },
  'stomach.solidKcalPerMin': { sources: ['abell2008'], basis: 'calibrated' },
  'stomach.solidLagMin': { sources: ['siegel1988'], basis: 'calibrated' },
  'glucose.fastingMgDl': { sources: ['freckmann2007'], basis: 'measured' },
  'glucose.insulinTauMin': { sources: ['bergman1979'], basis: 'calibrated' },
  'glucose.insulinGain': { sources: ['bergman1979'], basis: 'calibrated' },
  'glucose.gainMgDlPerG': { sources: ['freckmann2007'], basis: 'calibrated' },
  'glucose.solidGlycemicCorrection': { sources: ['brouns2005'], basis: 'calibrated' },
  'glucose.bandLow': { sources: [], basis: 'assumption' },
  'glucose.bandHigh': { sources: [], basis: 'assumption' },
  'glucose.clearanceTauMin': { sources: ['bergman1979'], basis: 'calibrated' },
  'glucose.bluntingK': { sources: ['moghaddam2006'], basis: 'calibrated' },
  'glucose.bluntingFloor': { sources: [], basis: 'assumption' },
  // Where the "back to before-meal level" marker is drawn. ADA 2001 (2–3 h) is context only.
  'glucose.backToBaseMgDl': { sources: ['ada2001'], basis: 'display' },

  'eating.solidGramsPerMin': { sources: [], basis: 'assumption' },
  'eating.minSolidMin': { sources: [], basis: 'assumption' },
  'eating.maxMin': { sources: [], basis: 'assumption' },
  'eating.liquidMin': { sources: [], basis: 'assumption' },
  'esophagus.transitMin': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  // Emptying data come from meals up to about this size; above it the model is not meant to be used.
  maxMealKcal: { sources: ['hunt1975'], basis: 'assumption' },

  // Model version 3 (E-3a), OpenStax §23.7 in the small intestine: water "About 90 percent", protein
  // "95 to 98 percent" (low end), lipids "About 95 percent"; indigestible fibre is not absorbed.
  // Carbohydrate: OpenStax says "all" without a number, so USDA Handbook 74's mixed-diet 97 % (p. 9).
  'absorbedInSmallIntestine.fat': { sources: ['openstax-ap2e-23', 'merrill1955'], basis: 'measured' },
  'absorbedInSmallIntestine.fiber': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  'absorbedInSmallIntestine.carbs': { sources: ['merrill1955', 'openstax-ap2e-23'], basis: 'measured' },
  'absorbedInSmallIntestine.protein': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  'absorbedInSmallIntestine.water': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  // Carbs: calibrated together with the glucose curve. The others are modelling assumptions.
  'absorptionTauMin.carbs': { sources: ['freckmann2007'], basis: 'calibrated' },
  'absorptionTauMin.protein': { sources: [], basis: 'assumption' },
  'absorptionTauMin.fat': { sources: [], basis: 'assumption' },
  'absorptionTauMin.water': { sources: [], basis: 'assumption' },
  'absorptionTauMin.fiber': { sources: [], basis: 'assumption' },
  colonWaterAbsorbed: { sources: [], basis: 'assumption' },
  colonWaterTauMin: { sources: [], basis: 'assumption' },

  'smallIntestine.typicalMin': { sources: ['openstax-ap2e-23', 'nandhra2023'], basis: 'measured' },
  'smallIntestine.lowMin': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  'smallIntestine.highMin': { sources: ['nandhra2023'], basis: 'measured' },
  'colon.typicalMin': { sources: ['openstax-ap2e-23', 'nandhra2023'], basis: 'measured' },
  'colon.lowMin': { sources: ['openstax-ap2e-23'], basis: 'measured' },
  'colon.highMin': { sources: ['nandhra2023'], basis: 'measured' },
  // "Almost nothing left over" below 1 g of fibre: decides whether the leftovers marker is shown.
  residueThresholdG: { sources: [], basis: 'display' },

  // FNP 77 §3.5.1: the general factors 4.0 / 9.0 / 4.0 kcal/g (protein, fat, carbohydrate).
  'energy.atwaterKcalPerG.carbs': { sources: ['fao2003'], basis: 'measured' },
  'energy.atwaterKcalPerG.protein': { sources: ['fao2003'], basis: 'measured' },
  'energy.atwaterKcalPerG.fat': { sources: ['fao2003'], basis: 'measured' },

  // The run window and resolution (48 h, 1 min): presentation choices.
  horizonMin: { sources: [], basis: 'display' },
  stepMin: { sources: [], basis: 'display' },
}
