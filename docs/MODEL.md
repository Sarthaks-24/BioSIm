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
| Sugars / starch | 10 min | 95 % |
| Protein | 40 min | 90 % |
| Fat | 60 min | 95 % |
| Water | 20 min | 80 % |
| Fibre | — | 0 % |

So most absorption happens early, in the jejunum, and fat later, after bile has worked on it (OpenStax §23.7). The carbohydrate time constant is calibrated with the glucose curve; the others are modelling assumptions.

The large intestine absorbs 90 % of the water that reaches it, slowly. Whatever is left eventually leaves the body.

Mass is conserved at every minute: stomach + intestines + absorbed + left the body = eaten. A test checks this.

## Blood glucose

1. The carbohydrate being absorbed is weighted by its food's glycemic index. This uses the **same** absorption as above, so the glucose curve and the "absorbed" numbers always agree.
2. Fat and protein blunt it by `1 / (1 + 0.15 × (2·protein + fat) / carbs)`, with a floor of 0.6. Protein counts double, gram for gram (Moghaddam et al. 2006).
3. Plasma glucose rises. Baseline clearance and an insulin-action term that builds while glucose is raised pull it back down. The structure follows the Bergman minimal model (1979); the constants are calibrated.
4. Foods with no published GI have too little carbohydrate to test, so they count as having no glycemic effect.

A food's GI already includes how slowly that food leaves the stomach. One correction factor stops solids being slowed twice. It is calibrated so simulated white bread (GI 75) gives 75 % of the 2-hour glucose area of 50 g glucose, which is the definition of GI (Brouns et al. 2005).

**Golden tests:**

- 50 g glucose peaks at +30–60 mg/dL within 30–60 min and is near baseline by 2 h.
- A starchy solid meal peaks later, but within 75 min. Meal studies peak at ~46–50 min (Freckmann et al. 2007); the model gives ~60 min.
- Fat and protein flatten the curve.

The display is a **band**, from 0.65× to 1.45× the typical curve, because glycemic responses vary a lot between people.

**Back to before-meal level.** The marker is the first minute after the peak when the typical curve is within **5 mg/dL** of fasting (`PARAMS.glucose.backToBaseMgDl`). The 5 mg/dL is a display choice, not physiology. For context, blood sugar after a meal is usually back to its before-meal level within 2–3 h (American Diabetes Association 2001). The model gets there in about 2 h for a sugary drink, but takes about 4 h for white bread and longer for big fatty meals (see Known limits); a test marks this as a known limit.

## Energy in vs used

Two lines on one kcal/h axis: the food energy from this meal **coming in**, and the energy the body **uses at rest**. It is a comparison, not a score: nothing is "good" or "bad", and there is no 0–100 bar.

**The person.** Energy use depends on who is eating, so every run states its person (`core/profile.ts`). The default, and the only one in v2.0, is `adult-ref`, tagged "Adult model": the ICMR-NIN 2020 reference Indian adult man, 19–39 years, 65 kg, at rest. Digestion and blood sugar do not depend on the person; their data come from studies of adults.

**Energy coming in** (`energy.inRate`, `energy.inTotal`): status *simulated* ("Calculated from studies").

    energy in (kcal) = 4 × carbohydrate + 4 × protein + 9 × fat   (grams absorbed so far)

The factors are the Atwater general factors, 4.0 / 4.0 / 9.0 kcal per gram (FAO 2003, §3.5.1; `PARAMS.energy.atwaterKcalPerG`). They are applied to the grams the absorption model has taken into the body, so the line rises as the meal is absorbed. The rate is the change per minute, × 60 (kcal/h).

**Energy used at rest** (`energy.usedRate`, `energy.usedTotal`): status *assumption* ("Best guess").

    resting use (kcal/day) = (15.057 × 65 + 692.2) × 0.9 = 1503.8 kcal/day ≈ 62.7 kcal/h

- 15.057 × weight + 692.2 is the Schofield equation for men aged 18–30 years (FAO/WHO/UNU 2004, §5.2, Table 5.2): 1671 kcal/day at 65 kg.
- × 0.9: ICMR-NIN 2020 lowers the FAO/WHO/UNU basal rate by 10 % for Indian adults, because the equations overestimate Indian basal rates by 10–12 %.
- The line is the same at every minute and for every meal.

**Golden tests** (`test/energy.test.ts`):

- Schofield at 65 kg = 1671 kcal/day (±1); with ICMR's −10 %, 1504 kcal/day (±1).
- × the sedentary physical activity level of 1.40 gives 2105 kcal/day, within 0.5 % of ICMR-NIN 2020's 2110 kcal/day for the sedentary 65 kg man.
- Energy in equals the Atwater sum of the absorbed grams at every minute (±0.01 kcal), and the hourly rate adds up to the total.
- After 48 h, 85–100 % of each food's Atwater energy has come in (most carbohydrate, protein and fat is absorbed: OpenStax §23.7). The model gives 93–95 %.
- Energy used is identical for every meal.

**Limits.**

- Energy coming in uses the standard factors, so the total can differ a little from the food label. Fibre's small energy (gut bacteria ferment part of it) is left out.
- The Atwater factors already allow for the part of each nutrient the body does not absorb (FAO 2003). Applying them to absorbed grams counts that loss twice, so energy in reads a few per cent low.
- Energy used is a formula for one resting adult, not a measurement. It leaves out digesting the meal and any movement, and it does not change with the meal.

## Signals

Every number the app shows is one of these IDs (`packages/engine/src/core/catalog.ts`). `simulate()` returns them as `signals` (ID → series, one value per minute) and `moments` (event ID → minute). The table is written by hand from the catalog; the catalog wins if they disagree.

"Status" is what the screen says: *simulated* = "Calculated from studies", *assumption* = "Best guess".

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

The food data comes from:

- USDA FoodData Central (SR Legacy)
- the Indian Nutrient Databank (Vijayakumar et al. 2024, built on IFCT 2017)
- Atkinson et al. 2008

Each food file cites its own sources.

**Still needed:** sign-off from a named physiology or biology reviewer before the teacher pilot.
