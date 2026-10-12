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
| t½, t90 | Time until 50 % / 90 % of the meal has left the stomach, measured by **food energy** (by weight only for water), so a drink added to a meal can't make the meal look faster |
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
- **Assumption:** the solid rate is the same for small and big meals. Real stomachs empty a little faster (in kcal/min) after bigger meals, so the model is slow for very large meals. Making the rate depend on meal size is deferred until it can be calibrated without breaking the checks above.

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

## Known limits

- It models a healthy adult only: not children, pregnancy, diabetes or digestive illness.
- Milk clots in the stomach and really empties more slowly than the liquid model shows.
- Fibre isn't modelled on its own. Its effect on blood sugar shows up only through each food's GI.
- GI values vary between studies and varieties (rice ranges from about 50 to over 90).
- Peaks for solid meals come out ~10 min later than continuous-glucose-monitor data.
- After big, fatty meals the model shows a small, slow tail of raised blood sugar (+5–7 mg/dL) while carbohydrate is still trickling out of the stomach. Real bodies usually settle sooner; the chart says so.
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

The food data comes from:

- USDA FoodData Central (SR Legacy)
- the Indian Nutrient Databank (Vijayakumar et al. 2024, built on IFCT 2017)
- Atkinson et al. 2008

Each food file cites its own sources.

**Still needed:** sign-off from a named physiology or biology reviewer before the teacher pilot.
