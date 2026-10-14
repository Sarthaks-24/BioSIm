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
  // ── New in model version 3 (E-3b-eng: activity and the food effect) ──
  /**
   * Checked 2026-10-13 (V-0 item 1, V-0b item 1): "METs reflect the ratio of a PA's energy cost in
   * mL/kg/min relative to a standardized RMR of 3.5 mL/kg/min"; pacompendium.com "1 MET = 3.5
   * ml/kg/min", "METS to Kcal/min = multiply METS x 3.5 x body weight in kg then divide by 200".
   * Rows read on pacompendium.com, none marked estimated: 17190 3.8, 17200 4.8, 12050 9.3, 07021 1.0;
   * hidden kinds 09065 1.8, 15610 7.0, 15150 4.8, 15030 5.5.
   */
  herrmann2024: {
    kind: 'dataset',
    check: 'checked',
    usedFor: '2024 Adult Compendium: MET definition, kcal/min conversion, MET of each activity',
    url: 'https://pacompendium.com',
    citation:
      'Herrmann SD, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. J Sport Health Sci 2024;13:6–12.',
  },
  // ── New in model version 3 (S-1: effort, muscles + skin; V-1) ──
  /**
   * Checked 2026-10-14 (V-1, abstract via Europe PMC, PMID 21836642): "Elia (1992) identified the
   * specific resting metabolic rates (K(i)) of major organs and tissues in young adults with normal
   * weight: … 13 for skeletal muscle … (all units in kcal/kg per day)." Elia 1992 itself not read.
   */
  wang2012: {
    kind: 'paper',
    check: 'checked',
    usedFor: "Elia 1992's resting rate of skeletal muscle, 13 kcal per kg per day",
    url: 'https://doi.org/10.1038/oby.2011.256',
    citation:
      'Wang Z, et al. Evaluation of specific metabolic rates of major organs and tissues: comparison between nonobese and obese women. Obesity 2012;20:95–100.',
  },
  /**
   * Checked 2026-10-14 (V-1, abstract via Europe PMC, PMID 10904038): whole-body MRI, 468 adults;
   * "Men had significantly (P < 0.001) more SM … relative to body mass (38.4 vs. 30.6%)".
   */
  janssen2000: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'skeletal muscle is 38.4 % of body mass in men',
    url: 'https://doi.org/10.1152/jappl.2000.89.1.81',
    citation:
      'Janssen I, Heymsfield SB, Wang ZM, Ross R. Skeletal muscle mass and distribution in 468 men and women aged 18–88 yr. J Appl Physiol 2000;89:81–88.',
  },
  /**
   * Checked 2026-10-14 (V-1, full text, Europe PMC PMC6773238): "The latent heat of vaporization of
   * sweat is 580 kcal of heat per 1 kg of evaporated sweat (2426 J per gram of sweat)"; ~0.3 L/h "is
   * at the very low end of the range of sweating rates expected during exercise/heat stress".
   */
  baker2019: {
    kind: 'paper',
    check: 'checked',
    usedFor: '580 kcal of heat leaves with each kg of sweat evaporated; ~0.3 L/h is the low end in exercise',
    url: 'https://doi.org/10.1080/23328940.2019.1632145',
    citation:
      'Baker LB. Physiology of sweat gland function: the roles of sweating and sweat composition in human health. Temperature 2019;6:211–259.',
  },
  /**
   * Checked 2026-10-14 (V-1, full text, Europe PMC PMC7125257): whole-body sweating rates "~ 0.2 to 3
   * L/h across a wide range of individuals, activities, and environmental conditions"; "exercise of
   * low intensity (e.g., walking) and light sweating (0.3–0.6 L/h)".
   */
  bakerwolfe2020: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'sweating rates ~0.2–3 L/h; walking 0.3–0.6 L/h',
    url: 'https://doi.org/10.1007/s00421-020-04323-7',
    citation: 'Baker LB, Wolfe AS. Physiological mechanisms determining eccrine sweat composition. Eur J Appl Physiol 2020;120:719–752.',
  },
  /**
   * Checked 2026-10-14 (V-1, §24.6 "Energy and Heat Balance"): at rest about 60 % of heat is lost by
   * radiation, 15 % by convection, 3 % by conduction and 20 % by evaporation; "Sweating is the
   * primary means of cooling the body during exercise"; core temperature "around 36.5–37.5 °C".
   */
  'openstax-ap2e-24': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'how heat leaves the body at rest (60/15/3/20 %); sweating cools in exercise',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/24-6-energy-and-heat-balance',
    citation: 'OpenStax. Anatomy and Physiology 2e, ch. 24 (§24.6 Energy and Heat Balance). Rice University.',
  },
  /**
   * Checked 2026-10-14 (E-3b-eng, full text, Europe PMC PMC524030): "Reported DIT values for separate
   * nutrients are 0 to 3% for fat, 5 to 10% for carbohydrate, 20 to 30% for protein"; "A mixed diet
   * consumed at energy balance results in a diet induced energy expenditure of 5 to 15 %".
   */
  westerterp2004: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'food effect per nutrient (0–3 % fat, 5–10 % carbohydrate, 20–30 % protein); mixed diet 5–15 %',
    url: 'https://doi.org/10.1186/1743-7075-1-5',
    citation: 'Westerterp KR. Diet induced thermogenesis. Nutr Metab (Lond) 2004;1:5.',
  },
  /**
   * Checked 2026-10-14 (E-3b-eng, full text, Europe PMC PMC4736092): 60 g glucose in 500 mL water,
   * REE "peak values being reached between 50 and 60 min post-drink"; "the lower thermic effect of
   * glucose (6·9 %)", over 150 min, by when it was "more than 90 % completed".
   */
  charriere2016: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'food effect of 60 g glucose: 6.9 % of its energy, peak at 50–60 min (hold-out)',
    url: 'https://doi.org/10.1017/jns.2015.41',
    citation:
      'Charrière N, Montani JP, Dulloo AG. Postprandial thermogenesis and respiratory quotient in response to galactose: comparison with glucose and fructose in healthy young adults. J Nutr Sci 2016;5:e4.',
  },
  /**
   * Checked 2026-10-14 (E-3b-eng, abstract via Europe PMC, PMID 8561055): 131 six-hour tests; "Of the
   * total 6-h TEF, 60% of the total had been measured after 3 h. 78% after 4 h, and 91% after 5 h."
   */
  reed1996: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'timing of the food effect: 60 % of the 6 h total by 3 h, 91 % by 5 h',
    url: 'https://doi.org/10.1093/ajcn/63.2.164',
    citation: 'Reed GW, Hill JO. Measuring the thermic effect of food. Am J Clin Nutr 1996;63:164–169.',
  },
  // ── New in model version 3 (S-2: breathing; read in V-2, 2026-10-14) ──
  /**
   * Checked 2026-10-14 (V-2, full text, Europe PMC PMC6358081): Eq 1, Weir's "EE = VO2 (3.941 +
   * 1.106 (RQ)) (1 + 0.082 P)"; "when RQ equals 0.7, each liter of VO2 represents ~4.7 kcal, but
   * when RQ equals 1.0 the value is ~5 kcal".
   */
  kaiyala2019: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'Weir equation (3.941 + 1.106·RQ kcal per L O2); ~4.7 kcal/L at RQ 0.7, ~5 at 1.0',
    url: 'https://doi.org/10.1371/journal.pone.0211585',
    citation:
      'Kaiyala KJ, Wisse BE, Lighton JRB. Validation of an equation for energy expenditure that does not require the respiratory quotient. PLoS One 2019;14:e0211585.',
  },
  /**
   * Checked 2026-10-13/14 (V-0 extra, V-2; abstract via Europe PMC, PMID 15831804): 769 adults,
   * resting VO2 "2.6 +/- 0.4 ml O2 x kg(-1) x min(-1)"; 3.5 "overestimates the actual resting VO2
   * value on average by 35%".
   */
  byrne2005: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'resting O2 use 2.6 ± 0.4 mL/kg/min (lower edge of the resting golden)',
    url: 'https://doi.org/10.1152/japplphysiol.00023.2004',
    citation:
      'Byrne NM, Hills AP, Hunter GR, Weinsier RL, Schutz Y. Metabolic equivalent: one size does not fit all. J Appl Physiol 2005;99:1112–1119.',
  },
  /** Checked 2026-10-14 (V-2, abstract via Europe PMC, PMID 2204507): one MET "is equal to 3.5 ml O2 per kg body weight x min". */
  jette1990: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'resting O2 use convention 3.5 mL/kg/min (upper edge of the resting golden)',
    url: 'https://doi.org/10.1002/clc.4960130809',
    citation:
      'Jetté M, Sidney K, Blümchen G. Metabolic equivalents (METS) in exercise testing, exercise prescription, and evaluation of functional capacity. Clin Cardiol 1990;13:555–565.',
  },
  /**
   * Checked 2026-10-14 (V-2, full text, Europe PMC PMC4923235): RER "from the baseline value of
   * ~0.83 to predominantly carbohydrates utilization with RER = 0.91", plateau "approximately two
   * hours"; shakes (Table 2) high-CHO 548 kcal, 123 g CHO, 3 g fat, 7 g protein; high-fat 519 kcal,
   * 12 g CHO, 51 g fat, 7 g protein; postprandial "RER slope (0.0049 … vs. 0.0033 …)" HC vs HF.
   */
  gribok2016: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'fasting RQ ~0.83; carbohydrate shake RQ rise 0.83 → 0.91; a fat shake rises more slowly',
    url: 'https://doi.org/10.14814/phy2.12835',
    citation:
      'Gribok A, Leger JL, Stevens M, Hoyt R, Buller M, Rumpler W. Measuring the short-term substrate utilization response to high-carbohydrate and high-fat meals in the whole-body indirect calorimeter. Physiol Rep 2016;4:e12835.',
  },
  /**
   * Checked 2026-10-14 (V-2, openstax.org): §22.3 "By adolescence, the normal respiratory rate is
   * similar to that of adults, 12 to 18 breaths per minute"; tidal volume "is about 500
   * milliliters". §22.4: CO2 "partial pressure in the alveoli is about 40 mm Hg" (Table 22.3).
   */
  'openstax-ap2e-22': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'adult resting breaths 12–18/min, tidal volume about 500 mL (§22.3); alveolar CO2 40 mm Hg (§22.4)',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/22-3-the-process-of-breathing',
    citation: 'Betts JG, et al. Anatomy and Physiology 2e, ch. 22 The Respiratory System. OpenStax, Houston TX, 2022.',
  },
  /**
   * Checked 2026-10-13 (V-0b item 5, gssiweb.org): Romijn 1993's fuel shift in words only: at 25 %
   * VO2max "FFA the dominant fuel", at 65 % fat and carbohydrate "about 50/50". The exercise RQ
   * floor rests on this direction; its numbers are a calibration (R51; Romijn's tables not read).
   */
  spriet2020: {
    kind: 'report',
    check: 'checked',
    usedFor: 'exercise fuel shift toward carbohydrate (direction of the RQ floor)',
    url: 'https://www.gssiweb.org/en/sports-science-exchange/Article/regulation-of-fat-metabolism-during-exercise',
    citation:
      'Spriet LL, Randell R. Regulation of fat metabolism during exercise. Sports Science Exchange 2020;29(205):1–6. Gatorade Sports Science Institute.',
  },
  /**
   * Checked 2026-10-13 (V-0b items 2 and 5, abstract via Europe PMC, PMID 2289500): sub-elite
   * runners, treadmill marathon at 68–76 % VO2max, "RER (0.96, SD 0.07 vs 0.91, SD 0.04)".
   */
  bosch1990: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'running RER 0.91–0.96 (cross-check of the exercise RQ floor, R57)',
    url: 'https://doi.org/10.1007/bf00236696',
    citation:
      'Bosch AN, Goslin BR, Noakes TD, Dennis SC. Physiological differences between black and white runners during a treadmill marathon. Eur J Appl Physiol 1990;61:68–72.',
  },
  /**
   * Checked 2026-10-13 (V-0, ncert.nic.in gesc106.pdf, Reprint 2024-25): "an adult human being at
   * rest breathes in and out 15-18 times in a minute"; exhaled air "16.4% oxygen", "4.4% carbon
   * dioxide" (R54). Shown as "Older NCERT Class 7 book (2024-25) says" (R29).
   */
  'ncert-c7-2024': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'book values: resting breaths 15–18/min; exhaled air 16.4 % O2, 4.4 % CO2 (todo golden)',
    url: 'https://ncert.nic.in/textbook/pdf/gesc106.pdf',
    citation: 'NCERT. Science, Textbook for Class VII, ch. 6 Respiration in Organisms. NCERT, New Delhi, reprint 2024-25.',
  },
  // ── New in model version 3 (S-4: water, kidneys; V-4) ──
  /**
   * Checked 2026-10-14 (V-4): §25.1 "minimum urine volume of about 500 mL/day"; §25.2 "When bladder
   * volume reaches about 150 mL, an urge to void is sensed", "nearly zero to 500–600 mL"; §25.5
   * "about 125 mL/min filtrate produced in males (range of 90 to 140 mL/min)"; §25.6 glucose "about
   * 375 mg/min", "about 200 mg/dL".
   */
  'openstax-ap2e-25': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'least urine 500 mL/day; bladder urge at 150 mL, holds up to 500–600 mL; filtration 125 mL/min',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/25-1-physical-characteristics-of-urine',
    citation: 'OpenStax. Anatomy and Physiology 2e, ch. 25 (§25.1, §25.2, §25.5, §25.6). Rice University.',
  },
  /** Checked 2026-10-14 (V-4, §26.2): "an average of 1.5 liters (1.6 quarts) of urine per day"; "about 230 mL … generated metabolically". */
  'openstax-ap2e-26': {
    kind: 'textbook',
    check: 'checked',
    usedFor: 'urine 1.5 L a day on an ordinary day; about 230 mL of water a day made by metabolism',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/26-2-water-balance',
    citation: 'OpenStax. Anatomy and Physiology 2e, ch. 26 (§26.2 Water Balance). Rice University.',
  },
  /**
   * Checked 2026-10-14 (V-4, ch. 4): p85 metabolic water "approximately 15, 10.5, and 11.1 g/100 kcal"
   * (carbohydrate, protein, fat); p74 "maximal excretion rate of approximately 0.7 to 1.0 L/hour"; p83
   * "600 to 1,000 mL/hour with water loading".
   */
  iom2005: {
    kind: 'report',
    check: 'checked',
    usedFor: 'metabolic water 0.105–0.15 mL per kcal; the kidney sends out at most 0.7–1.0 L an hour',
    url: 'https://www.nationalacademies.org/read/10925/chapter/6',
    citation:
      'Institute of Medicine. Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate, ch. 4. National Academies Press, 2005.',
  },
  /** Checked 2026-10-14 (V-4, abstract, PMID 26702122): 1 L still water over 30 min; urine over 4 h "1337 ± 330 g". */
  maughan2016: {
    kind: 'paper',
    check: 'checked',
    usedFor: '1 L of water: 1337 ± 330 mL of urine in 4 h (drinks of equal water alike; milk and ORS less)',
    url: 'https://doi.org/10.3945/ajcn.115.114769',
    citation:
      'Maughan RJ, et al. A randomized trial to assess the potential of different beverages to affect hydration status: development of a beverage hydration index. Am J Clin Nutr 2016;103:717–723.',
  },
  /** Checked 2026-10-14 (V-4, abstract, PMID 3687569): 20 mL/kg water; young men's peak diuresis 10.86 mL/kg per hourly sample; 100.7 % (70 % if short of water) out in 2 h. */
  crowe1987: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'after a 20 mL/kg drink, urine peaks near 700 mL/h at 65 kg; 70–100 % is out in 2 h',
    url: 'https://doi.org/10.1093/ageing/16.5.285',
    citation: 'Crowe MJ, et al. Altered water excretion in healthy elderly men. Age Ageing 1987;16:285–293.',
  },
  /** Checked 2026-10-14 (V-4, full text, PMC11231081): vasopressin's "plasma half-life is only 5 to 20 min". */
  calvi2024: {
    kind: 'paper',
    check: 'checked',
    usedFor: 'ADH (vasopressin) half-life 5–20 min: how fast the kidney follows extra water',
    url: 'https://doi.org/10.3389/fendo.2024.1346082',
    citation:
      'Calvi A, et al. Urinary hyaluronidase activity is closely related to vasopressinergic system following an oral water load in men. Front Endocrinol 2024;15:1346082.',
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

  // Food effect: Westerterp 2004's per-nutrient ranges (middle values); the lag is calibrated on
  // Reed & Hill 1996 (60 % of the 6 h effect by 3 h). Charrière 2016 is the hold-out.
  'energy.foodEffect.carbs': { sources: ['westerterp2004'], basis: 'measured' },
  'energy.foodEffect.protein': { sources: ['westerterp2004'], basis: 'measured' },
  'energy.foodEffect.fat': { sources: ['westerterp2004'], basis: 'measured' },
  'energy.foodEffect.tauMin': { sources: ['reed1996'], basis: 'calibrated' },

  // Effort (S-1, V-1): resting muscle = Elia's 13 kcal/kg/day (via Wang 2012) × Janssen's 38.4 %;
  // sweat carries 0.58 kcal per mL evaporated (Baker 2019); the resting heat-loss shares (OpenStax §24.6).
  'effort.muscleKcalPerKgDay': { sources: ['wang2012'], basis: 'measured' },
  'effort.muscleMassShare': { sources: ['janssen2000'], basis: 'measured' },
  'effort.sweatKcalPerMl': { sources: ['baker2019'], basis: 'measured' },
  'effort.restHeatLoss.radiation': { sources: ['openstax-ap2e-24'], basis: 'measured' },
  'effort.restHeatLoss.convection': { sources: ['openstax-ap2e-24'], basis: 'measured' },
  'effort.restHeatLoss.conduction': { sources: ['openstax-ap2e-24'], basis: 'measured' },
  'effort.restHeatLoss.evaporation': { sources: ['openstax-ap2e-24'], basis: 'measured' },

  // Activity: the 2024 Compendium's MET definition, conversion and rows (V-0 item 1, V-0b).
  'activity.restO2MlPerKgMin': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.kcalPerLO2': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.walk': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.walkBrisk': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.run': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.sitClass': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.football': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.cricket': { sources: ['herrmann2024'], basis: 'measured' },
  'activity.met.badminton': { sources: ['herrmann2024'], basis: 'measured' },

  // Breathing (S-2, V-2). Weir via Kaiyala 2019; fasting RQ from Charrière 2016 (0.78–0.81) and
  // Gribok 2016 (~0.83); kRQ calibrated on Gribok's carbohydrate shake (rise ~0.08); the exercise
  // floor is a calibration on the fuel shift's direction (R51); alveolar CO2 40 mm Hg from OpenStax
  // §22.4. The breath rate/depth split and the dead space are hand-picked (model §2.2 Limits).
  'gas.weirO2': { sources: ['kaiyala2019'], basis: 'measured' },
  'gas.weirCo2': { sources: ['kaiyala2019'], basis: 'measured' },
  'gas.rqFasting': { sources: ['charriere2016', 'gribok2016'], basis: 'measured' },
  'gas.rqPerMgDl': { sources: ['gribok2016'], basis: 'calibrated' },
  'gas.rqFloorBase': { sources: ['spriet2020'], basis: 'calibrated' },
  'gas.rqFloorPerMet': { sources: ['spriet2020'], basis: 'calibrated' },
  'gas.rqMin': { sources: ['kaiyala2019'], basis: 'assumption' },
  'gas.rqMax': { sources: ['kaiyala2019'], basis: 'assumption' },
  'gas.alveolarCo2MmHg': { sources: ['openstax-ap2e-22'], basis: 'measured' },
  'gas.alveolarK': { sources: [], basis: 'assumption' },
  'gas.restBreathsPerMin': { sources: ['openstax-ap2e-22', 'ncert-c7-2024'], basis: 'assumption' },
  'gas.breathRateExponent': { sources: [], basis: 'assumption' },
  'gas.deadSpaceMl': { sources: [], basis: 'assumption' },
  'gas.tidalMaxMl': { sources: [], basis: 'assumption' },

  // Water (S-4, V-4). The steady background day (D17): urine 1.5 L a day (OpenStax §26.2), never
  // below 500 mL a day (§25.1); the kidney's ceiling 0.7–1.0 L/h (IOM p74); metabolic water by fuel
  // 0.105–0.15 mL/kcal (IOM p85). kx and the ADH lag are calibrated on Maughan 2016 inside the AVP
  // half-life (Calvi 2024); Crowe 1987 is the hold-out. Urge at 150 mL (§25.2); emptying at 300 mL
  // is hand-picked inside "300 to 400 mL"; filtration 125 mL/min (§25.5).
  'water.metabolicMlPerKcal': { sources: ['iom2005'], basis: 'measured' },
  'water.backgroundUrineMlPerDay': { sources: ['openstax-ap2e-26'], basis: 'assumption' },
  'water.minUrineMlPerH': { sources: ['openstax-ap2e-25'], basis: 'measured' },
  'water.maxUrineMlPerH': { sources: ['iom2005'], basis: 'measured' },
  'water.adhTauMin': { sources: ['calvi2024', 'maughan2016'], basis: 'calibrated' },
  'water.urinePerExtraMlPerMin': { sources: ['maughan2016'], basis: 'calibrated' },
  'water.bladderUrgeMl': { sources: ['openstax-ap2e-25'], basis: 'measured' },
  'water.bladderEmptyMl': { sources: ['openstax-ap2e-25'], basis: 'assumption' },
  'water.filtrationMlPerMin': { sources: ['openstax-ap2e-25'], basis: 'measured' },

  // The run window and resolution (48 h, 1 min): presentation choices.
  horizonMin: { sources: [], basis: 'display' },
  stepMin: { sources: [], basis: 'display' },
}
