# The LifePeek model

**Model version:** see `MODEL_VERSION` in `packages/engine/src/params.ts`.

Every tunable number lives in `params.ts`, next to its source. If you change one:

- bump `MODEL_VERSION`;
- run `npm run calibrate -w @lifepeek/engine` to see the outputs next to their published targets;
- update the golden tests.

Old share links still open. The app tells the viewer the numbers may differ from when the link was shared.

## Glossary

| Term | Meaning |
|---|---|
| Stage | One of mouth, oesophagus (code: `esophagus`), stomach, small intestine, large intestine (code: `largeIntestine`; "colon" in params) |
| Leftovers | Fibre — the part the body can't digest. Small unabsorbed amounts of sugar, protein or fat are fermented by gut bacteria and don't count |
| t½, t90 | Time until 50 % / 90 % of the meal has left the stomach, measured by **food energy** (by weight only for water), so water added to a meal can't make the meal look faster (a drink with calories can make it look a little faster, because its energy leaves first) |
| GI | Glycemic index: blood-sugar area after 50 g of a food's carbohydrate, as a % of 50 g glucose |
| Fibre / fiber | Same thing. The UI uses UK spelling; the code uses US spelling |

## What is computed and what is fixed

| Stage | How | Source |
|---|---|---|
| Mouth | Eating time from portion size (~35 g/min for solids, ~1 min for a drink) | Illustrative assumption |
| Oesophagus | ~6 s | OpenStax A&P 2e §23.3 (4–8 s solids, ~1 s liquids) |
| **Stomach** | **Computed from the meal** | See below |
| Small intestine | Fixed transit: typical 4 h, range 3–5.7 h | OpenStax §23.5; Nandhra et al. 2023 |
| Large intestine | Fixed transit: typical 22 h, range 12–29 h | OpenStax §23.5; Nandhra et al. 2023 |
| **Absorption & blood glucose** | **Computed from the meal** | See below |

Transit through the intestines varies far more between people than between meals. The model therefore uses typical values and shows the range wherever times are displayed.

## Stomach emptying

### Liquids (no lag)

Water empties exponentially, with a half-time of 16 min (Ziessman et al. 2009).

A drink with calories can't empty faster than the duodenum lets energy through: about 2.13 kcal per minute (Brener et al. 1983). It therefore empties in a straight line. The slower of the two curves wins.

### Solids

Solids must first be ground small, which gives a lag phase. After that they empty in a straight line at about 1.4 kcal/min.

- **Lag.** The emptying rate ramps up over 2 × 20 min. That gives a 20 min lag as the straight-line intercept, which is how Siegel et al. 1988 define it.
- **Rate.** 1.4 kcal/min is calibrated so the consensus 255 kcal test meal sits mid-range in the scintigraphy norms (Abell et al. 2008). Those norms are 37–90 % left at 1 h, 30–60 % at 2 h and ≤10 % at 4 h; the model gives 78 %, 45 % and 0 %.
- **Drinks with the meal.** The kcal of a drink taken with a solid meal use up part of the solids' time budget, so a sugary drink delays the food a little.
- **Fat, protein and carbohydrate** slow emptying equally per kcal (Hunt & Stubbs 1975). Fatty meals take longer simply because they carry more kcal.
- **Assumption:** the solid rate is the same for small and big meals. Real stomachs empty a little faster (in kcal/min) after bigger meals, so the model is slow for very large meals, and somewhat slow for everyday ones too (see Known limits). Making the rate depend on meal size is deferred until it can be calibrated without breaking the checks above.

**Meal cap.** The model is meant for meals up to **1500 kcal**. The picker won't build a larger meal. A link with a larger meal opens with a warning. A meal at the cap still empties within ~16 h.

## Absorption (one model for everything)

Each nutrient that reaches the small intestine is absorbed first-order, at its own speed:

| Nutrient | Time constant | Share absorbed in small intestine |
|---|---|---|
| Sugars / starch | 10 min | 97 % |
| Protein | 40 min | 95 % |
| Fat | 60 min | 95 % |
| Water | 20 min | 90 % |
| Fibre | — | 0 % |

So most absorption happens early, in the jejunum, and fat later, after bile has worked on it (OpenStax §23.7). The carbohydrate time constant is calibrated with the glucose curve; the others are modelling assumptions.

The shares (model version 3) are from OpenStax §23.7: "About 90 percent of this water is absorbed in the small intestine", protein "95 to 98 percent" (the low end is used), "About 95 percent of lipids". OpenStax says all normally digested carbohydrate is absorbed without a number, so carbohydrate uses the mixed-diet coefficient of 97 % from USDA Agriculture Handbook No. 74 (Merrill & Watt 1955, p. 9). That handbook gives protein 92 %, but it measures the whole gut (what does not come out in the faeces, including the body's own protein lost there), so the small-intestine figure from OpenStax is used for protein. Version 2 used 95 / 90 / 95 / 80 %; docs/MODEL-V3-DIFF.md lists what changed.

The large intestine absorbs 90 % of the water that reaches it, slowly. Whatever is left eventually leaves the body.

Mass is conserved at every minute: stomach + intestines + absorbed + left the body = eaten. A test checks this.

## Blood glucose

1. The carbohydrate being absorbed is weighted by its food's glycemic index. This uses the **same** absorption as above, so the glucose curve and the "absorbed" numbers always agree.
2. Fat and protein blunt it by `1 / (1 + 0.15 × (2·protein + fat) / carbs)`, with a floor of 0.6. Protein counts double, gram for gram (Moghaddam et al. 2006).
3. Plasma glucose rises. Baseline clearance and an insulin-action term that builds while glucose is raised pull it back down. The structure follows the Bergman minimal model (1979); the constants are calibrated.
4. Foods with no published GI have too little carbohydrate to test, so they count as having no glycemic effect.

A food's GI already includes how slowly that food leaves the stomach. One correction factor stops solids being slowed twice. It is calibrated so simulated white bread (GI 75) gives 75 % of the 2-hour glucose area of 50 g glucose, which is the definition of GI (Brouns et al. 2005).

**Golden tests:**

- 50 g glucose peaks at +30–60 mg/dL within 30–60 min and is near baseline by 2 h. The sample curves of the GI method (FAO/WHO 1998, ch. 4, Table 1: 50 g carbohydrate, one subject) peak at 30 min, 2.7–3.9 mmol/L (49–70 mg/dL) above fasting, and are within 0.6 mmol/L of fasting at 120 min.
- A starchy solid meal peaks later, but within 75 min. Meal studies peak at ~46–50 min (Freckmann et al. 2007); the model gives ~60 min.
- Fat and protein flatten the curve.

The display is a **band**, from 0.65× to 1.45× the typical curve, because glycemic responses vary a lot between people.

**Back to before-meal level.** The marker is the first minute after the peak when the typical curve is within **5 mg/dL** of fasting (`PARAMS.glucose.backToBaseMgDl`). The 5 mg/dL is a display choice, not physiology. For context, blood sugar after a meal is usually back to its before-meal level within 2–3 h (American Diabetes Association 2001). The model gets there in about 2 h for a sugary drink, but takes about 4 h for white bread and longer for big fatty meals (see Known limits); a test marks this as a known limit.

## Energy in vs used

Two lines on one kcal/h axis: the food energy from this meal **coming in**, and the energy the body **uses at rest**. It is a comparison, not a score: nothing is "good" or "bad", and there is no 0–100 bar.

**The person.** Energy use depends on who is eating, so every run states its person (`core/profile.ts`). The default, and the only one in v2.0, is `adult-ref`, tagged "Typical adult" (until WP-18 "Adult model"): the ICMR-NIN 2020 reference Indian adult man, 19–39 years, 65 kg, at rest. Digestion and blood sugar do not depend on the person; their data come from studies of adults.

**Energy coming in** (`energy.inRate`, `energy.inTotal`): status *simulated* ("Calculated from studies").

    energy in (kcal) = 4 × carbohydrate + 4 × protein + 9 × fat   (grams absorbed so far)

The factors are the Atwater general factors, 4.0 / 4.0 / 9.0 kcal per gram (FAO 2003, §3.5.1; `PARAMS.energy.atwaterKcalPerG`). They are applied to the grams the absorption model has taken into the body, so the line rises as the meal is absorbed. The rate is the change per minute, × 60 (kcal/h).

**Energy used at rest** (`energy.usedRate`, `energy.usedTotal`): status *assumption* ("Model estimate").

    resting use (kcal/day) = (15.057 × 65 + 692.2) × 0.9 = 1503.8 kcal/day ≈ 62.7 kcal/h

- 15.057 × weight + 692.2 is the Schofield equation for men aged 18–30 years (FAO/WHO/UNU 2004, §5.2, Table 5.2): 1671 kcal/day at 65 kg.
- × 0.9: ICMR-NIN 2020 lowers the FAO/WHO/UNU basal rate by 10 % for Indian adults, because the equations overestimate Indian basal rates by 10–12 %.
- The line is the same at every minute and for every meal.

**Golden tests** (`test/energy.test.ts`):

- Schofield at 65 kg = 1671 kcal/day (±1); with ICMR's −10 %, 1504 kcal/day (±1).
- × the sedentary physical activity level of 1.40 gives 2105 kcal/day, within 0.5 % of ICMR-NIN 2020's 2110 kcal/day for the sedentary 65 kg man.
- Energy in equals the Atwater sum of the absorbed grams at every minute (±0.01 kcal), and the hourly rate adds up to the total.
- After 48 h, 85–100 % of each food's Atwater energy has come in (most carbohydrate, protein and fat is absorbed: OpenStax §23.7). The model gives 95–97 %.
- Energy used is identical for every meal.

**Limits.**

- Energy coming in uses the standard factors, so the total can differ a little from the food label. Fibre's small energy (gut bacteria ferment part of it) is left out.
- The Atwater factors already allow for the part of each nutrient the body does not absorb (FAO 2003). Applying them to absorbed grams counts that loss twice, so energy in reads a few per cent low.
- Energy used is a formula for one resting adult, not a measurement. It does not change with the meal; moving and digesting are separate lines (next section).

## Moving and digesting (model version 3)

Two more ways the body uses energy, both status *assumption* ("Model estimate"). Neither changes digestion, blood sugar or energy coming in: in this version moving has no arrow into the gut or blood sugar.

**Energy used by moving** (`energy.activityRate`, `energy.activityTotal`). A run can carry activity bouts (walk, brisk walk, run; `core/activity.ts`). A MET is an activity's energy cost as a multiple of 3.5 mL O2 per kg per minute, and 1 L O2 ≈ 5 kcal, so the Compendium's cost is MET × 3.5 × kg / 200 kcal/min (Herrmann 2024; pacompendium.com). The model keeps its own resting use and adds only the cost above rest:

    moving (kcal/min) = (MET − 1) × 3.5 × 65 / 200

Walk 3.8 (17190), brisk walk 4.8 (17200), run 9.3 (12050), from the 2024 Adult Compendium; MET 1 adds exactly 0, so a resting run is unchanged to the byte. A 20-min walk adds 63.7 kcal.

**Energy used to digest** (`energy.foodEffectRate`, the thermic effect of food). Digesting and storing what was absorbed costs a share of its energy: 7.5 % of carbohydrate, 25 % of protein, 2 % of fat, the middle of Westerterp 2004's ranges. It follows absorption through a 20-min lag, calibrated so the consensus test meal gives 59 % of its 6 h effect in the first 3 h (Reed & Hill 1996: 60 %). The plan's first guess, 60 min, gave 44 %: the gut model already spreads absorption over about 3 h.

**Golden tests** (`test/activity.test.ts`): the Compendium rows; gross O2 use in a walk and a run within ±5 % of MET × 3.5 × kg; a mixed meal's 6 h food effect 5–15 % of its energy (Westerterp 2004); 60 g glucose 4–10 % over 150 min (Charrière 2016: 6.9 %, a hold-out); 50–75 % of the 6 h effect in 3 h (Reed & Hill 1996).

**Limits.** METs are averages for a 65 kg adult; the extra energy used after stopping is left out. Two known limits are marked in the tests: 60 g glucose peaks at about 115 min, not 50–60 min (the stomach lets the drink through at a steady rate, so absorption is flat for 2 h), and roti or idli with dal gives under half of its 6 h effect by 3 h (solids leave the stomach slowly in this model).

## Breathing (model version 3, S-2)

The gas module turns the energy used into oxygen used, carbon dioxide made and breathing. Every output is status *assumption* ("Model estimate"): it reads the energy used, whose resting part is one, and the split into breaths and depth is hand-picked. Sources were read in step V-2.

- **RQ** (`gas.exchangeRatio`) = 0.82 + 0.0025 × (glucose − 90), and in a bout at least 0.80 + 0.0127 × MET, kept within 0.70–1.00. Fasting 0.82 sits in the measured baselines (Charrière 2016: 0.78–0.81; Gribok 2016: ~0.83). The 0.0025 is calibrated so Gribok's 123 g carbohydrate shake raises RQ by 0.05–0.11 (they measured 0.83 → 0.91). The exercise floor is a calibration on the direction of the fuel shift (more carbohydrate at higher effort; Spriet 2020); Romijn 1993's own numbers could not be read. A run gives 0.918, inside the 0.91–0.96 measured in runners (Bosch 1990).
- **Oxygen and carbon dioxide** (`gas.o2UseRate`, `gas.co2OutRate`): Weir's equation without protein, energy = 3.941 × VO2 + 1.106 × VCO2 (Kaiyala 2019), so VO2 = energy ÷ (3.941 + 1.106 × RQ) and VCO2 = RQ × VO2. A litre of oxygen is 4.7 kcal at RQ 0.7 and 5.0 at RQ 1.0.
- **Breathing** (`lungs.breathRate`, `lungs.tidalVolume`): the lungs carry the CO2 away with alveolar CO2 held at 40 mm Hg (OpenStax §22.4), so alveolar air = 0.863 × VCO2 / 40 L/min. Breaths a minute = 15 × (alveolar air ÷ resting alveolar air)^(1/3); air per breath = alveolar air ÷ breaths + 150 mL of dead space, at most 2.5 L.

| | O2 used | CO2 made | Breaths/min | Air per breath |
|---|---|---|---|---|
| Rest | 215 mL/min | 177 mL/min | 15 | 404 mL |
| Walk (3.8 MET) | 867 mL/min | 735 mL/min | 24 | 808 mL |
| Run (9.3 MET) | 2116 mL/min | 1942 mL/min | 33 | 1.41 L |

**Tests** (`test/gas.test.ts`): Weir as an identity every minute; 4.7 / 5.0 kcal per litre (Kaiyala 2019); resting O2 use 2.2–3.6 mL/kg/min (Byrne 2005: 2.6 ± 0.4; Jetté 1990: 3.5); fasting RQ 0.78–0.86; Gribok's fat shake raises RQ less than the carbohydrate one (hold-out); resting breaths 12–18 and 400–600 mL a breath (OpenStax §22.3). Design guards: a meal changes breaths by at most 3 a minute; a run gives 25–45 breaths and 1–2.5 L a breath. A `todo`: exhaled air at rest should be the older NCERT Class 7 book's 16.4 % oxygen and 4.4 % carbon dioxide; the model gives about 17.4 % and 2.9 %, so no model value is shown for it.

**Limits.** Alveolar CO2 is held at 40 mm Hg (no feedback from blood gases); no ventilatory threshold, so hard running is under-breathed (trained runners reach 47–56 breaths, above the 45 guard); sea level; Weir without protein (about 1–2 %); blood fat does not move RQ, so a fatty meal hardly moves it (Gribok's fat shake did, more slowly); breathing changes only during a bout.

## Signals

Every number the app shows is one of these IDs (`packages/engine/src/core/catalog.ts`). `simulate()` returns them as `signals` (ID → series, one value per minute) and `moments` (event ID → minute). The table is written by hand from the catalog; the catalog wins if they disagree.

"Status" is what the screen says: *simulated* = "Calculated from studies", *assumption* = "Model estimate".

| ID | Unit | Status | Built from | Checked by golden tests against |
|---|---|---|---|---|
| `gut.stomach.contentG` | g | simulated | liquid + solid grams in the stomach (food as eaten) | OpenStax |
| `gut.stomach.liquidG` | g | simulated | drinks still in the stomach | Ziessman 2009, Brener 1983 |
| `gut.stomach.solidG` | g | simulated | solid food still in the stomach | Abell 2008, Siegel 1988, Hunt 1975 |
| `gut.small.contentG` | g | simulated | tracked nutrients in the small intestine | OpenStax (mass balance) |
| `gut.colon.contentG` | g | simulated | tracked nutrients in the large intestine | OpenStax, Nandhra 2023 |
| `gut.absorbed.carbsG`, `.proteinG`, `.fatG`, `.waterG` | g | simulated | running totals absorbed | OpenStax |
| `gut.absorbed.fibreG` | g | simulated | always 0 (fibre is not absorbed) | OpenStax |
| `gut.leftBodyG` | g | simulated | running total that has left the body | OpenStax |
| `blood.glucose` | mg/dL | simulated (band: assumption) | typical curve; band 0.65×–1.45× | Freckmann 2007, Bergman 1979, Brouns 2005, Atkinson 2008, Moghaddam 2006 |
| `energy.inRate`, `energy.inTotal` | kcal/h, kcal | simulated | 4·carbs + 4·protein + 9·fat of the absorbed grams | FAO 2003, OpenStax |
| `energy.usedRate`, `energy.usedTotal` | kcal/h, kcal | assumption | resting use of the run's person ÷ 24 (adult model: 62.7 kcal/h), same for every meal | FAO/WHO/UNU 2004, ICMR-NIN 2020 |
| `gas.o2UseRate`, `gas.co2OutRate` | mL/min | assumption | energy used through Weir's equation; CO2 = RQ × O2 (breathing pack row) | Kaiyala 2019, Byrne 2005, Jetté 1990 |
| `gas.exchangeRatio` | ratio | assumption | RQ from glucose, with an exercise floor (breathing pack row) | Charrière 2016, Gribok 2016, Bosch 1990 (cross-check) |
| `lungs.breathRate`, `lungs.tidalVolume` | breaths/min, mL | assumption | breaths and depth that carry the CO2 away at 40 mm Hg (breathing pack row) | OpenStax §22.3 |

| Event | Meaning | Checked against |
|---|---|---|
| `event.stomachHalfEmpty` | half the meal's food energy has left the stomach (by weight for water) | Ziessman 2009, Hunt 1975 |
| `event.glucosePeak` | typical blood glucose is highest (none if the rise is under 1 mg/dL) | Freckmann 2007 |
| `event.glucoseBackToBase` | first minute after the peak within 5 mg/dL of fasting | ADA 2001 (context) |
| `event.mostlyAbsorbed` | 90 % of the carbohydrate, protein and fat that will be absorbed is in the body | OpenStax |
| `event.firstLeftovers` | leftovers (fibre) start leaving the body, with a between-person range | OpenStax, Nandhra 2023 |

"% of the meal in the stomach", "rise above fasting" and "where the meal is" are helpers computed from these (`core/derive.ts`), not IDs. `test/contract.test.ts` fails if an active ID has no golden test naming a source, and `test/regression.test.ts` pins today's numbers so the model cannot change by accident.

**Graph scales.** Each signal's `displayRange` in the catalog is its default y axis. An organism's registry can override it so everyday meals fill the graph (`apps/web/src/registry/human/organism.ts`). The human registry overrides two: stomach contents 0–600 g (catalog 0–1,000 g) and energy coming in 0–200 kcal/h (catalog 0–400 kcal/h; energy used shares that axis). A scale is the same for every meal and never shrinks. Only a value outside it stretches the axis once, to the next round number (four colas, 1,376 g, give 0–1,400 g), and the graph says so (`apps/web/src/lib/axis.ts`).

## Known limits

- It models a healthy adult only: not children, pregnancy, diabetes or digestive illness.
- Energy used is a resting formula for one reference adult (see Energy in vs used), not a measurement.
- Milk clots in the stomach and really empties more slowly than the liquid model shows.
- Everyday meals leave the stomach more slowly than textbooks say. OpenStax §23.4 gives 2–4 h for the stomach to empty after a meal; with its fixed 1.4 kcal/min solid rate the model takes ~4.5 h to empty 90 % of 2 rotis + dal or a portion of fries, and ~7.9 h for a burger with fries. A test marks this as a known limit; fixing it means a new model version and a physiology reviewer.
- Fibre isn't modelled on its own. Its effect on blood sugar shows up only through each food's GI.
- GI values vary between studies and varieties (rice ranges from about 50 to over 90).
- Peaks for solid meals come out ~10 min later than continuous-glucose-monitor data.
- After big, fatty meals the model shows a small, slow tail of raised blood sugar (+5–7 mg/dL) while carbohydrate is still trickling out of the stomach. Real bodies usually settle sooner; the chart says so.
- More of the same food or drink gives the same highest blood sugar, only for longer (cola ×1 and ×4 both peak at about 121 mg/dL). The stomach lets food out at a capped rate (Brener et al. 1983 for sugary drinks) and insulin action brings the curve down before even one serving has left, so the peak depends on the rate, not the amount. Real people usually reach a somewhat higher point with a bigger portion. A test pins this, and "How we know" on the blood-sugar graph says so.
- The insulin constants, the absorption time constants other than carbohydrate, and the eating pace are calibrated or assumed, not measured. `params.ts` says which.

## References

1. Abell TL, et al. Consensus recommendations for gastric emptying scintigraphy. *Am J Gastroenterol* 2008;103:753–763.
2. Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index and glycemic load values: 2008. *Diabetes Care* 2008;31:2281–2283.
3. Bergman RN, et al. Quantitative estimation of insulin sensitivity. *Am J Physiol* 1979;236:E667–E677.
4. Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. *Gastroenterology* 1983;85:76–82.
5. Brouns F, et al. Glycaemic index methodology. *Nutr Res Rev* 2005;18:145–171.
6. Freckmann G, et al. Continuous glucose profiles in healthy subjects. *J Diabetes Sci Technol* 2007;1:695–703.
7. Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. *J Physiol* 1975;245:209–225.
8. Moghaddam E, Vogt JA, Wolever TMS. Effects of fat and protein on glycemic responses. *J Nutr* 2006;136:2506–2511.
9. Nandhra GK, et al. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. *J Clin Med* 2023;12:5272.
10. OpenStax. *Anatomy and Physiology 2e*, ch. 23. Rice University.
11. Siegel JA, et al. Biphasic nature of gastric emptying. *Gut* 1988;29:85–89.
12. Wang YT, et al. Regional gastrointestinal transit and pH in 215 healthy volunteers. *Aliment Pharmacol Ther* 2015;42:761–772.
13. Ziessman HA, et al. Liquid gastric emptying. *J Nucl Med* 2009;50:726–731.
14. American Diabetes Association. Postprandial blood glucose. *Diabetes Care* 2001;24:775–778.
15. FAO/WHO/UNU. *Human energy requirements.* Report of a Joint FAO/WHO/UNU Expert Consultation. FAO Food and Nutrition Technical Report Series 1. Rome, 2004.
16. ICMR-National Institute of Nutrition. *Nutrient Requirements for Indians: Recommended Dietary Allowances and Estimated Average Requirements.* Hyderabad, 2020.
17. FAO. *Food energy – methods of analysis and conversion factors.* FAO Food and Nutrition Paper 77. Rome, 2003.
18. Merrill AL, Watt BK. *Energy value of foods: basis and derivation.* Agriculture Handbook No. 74. US Department of Agriculture, Washington DC, 1955.
19. FAO/WHO. *Carbohydrates in human nutrition.* Report of a Joint FAO/WHO Expert Consultation. FAO Food and Nutrition Paper 66. Rome, 1998.
20. Herrmann SD, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. *J Sport Health Sci* 2024;13:6–12.
21. Westerterp KR. Diet induced thermogenesis. *Nutr Metab (Lond)* 2004;1:5.
22. Charrière N, Montani JP, Dulloo AG. Postprandial thermogenesis and respiratory quotient in response to galactose: comparison with glucose and fructose in healthy young adults. *J Nutr Sci* 2016;5:e4.
23. Reed GW, Hill JO. Measuring the thermic effect of food. *Am J Clin Nutr* 1996;63:164–169.
24. Kaiyala KJ, Wisse BE, Lighton JRB. Validation of an equation for energy expenditure that does not require the respiratory quotient. *PLoS One* 2019;14:e0211585.
25. Byrne NM, Hills AP, Hunter GR, Weinsier RL, Schutz Y. Metabolic equivalent: one size does not fit all. *J Appl Physiol* 2005;99:1112–1119.
26. Jetté M, Sidney K, Blümchen G. Metabolic equivalents (METS) in exercise testing, exercise prescription, and evaluation of functional capacity. *Clin Cardiol* 1990;13:555–565.
27. Gribok A, Leger JL, Stevens M, Hoyt R, Buller M, Rumpler W. Measuring the short-term substrate utilization response to high-carbohydrate and high-fat meals in the whole-body indirect calorimeter. *Physiol Rep* 2016;4:e12835.
28. Spriet LL, Randell R. Regulation of fat metabolism during exercise. *Sports Science Exchange* 2020;29(205). Gatorade Sports Science Institute.
29. Bosch AN, Goslin BR, Noakes TD, Dennis SC. Physiological differences between black and white runners during a treadmill marathon. *Eur J Appl Physiol* 1990;61:68–72.

The food data comes from:

- USDA FoodData Central (SR Legacy)
- the Indian Nutrient Databank (Vijayakumar et al. 2024, built on IFCT 2017)
- Atkinson et al. 2008

Each food file cites its own sources.

**Still needed:** sign-off from a named physiology or biology reviewer before the teacher pilot.
