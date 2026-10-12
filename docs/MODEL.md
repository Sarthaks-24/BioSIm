# The BioSim model

Model version: see `MODEL_VERSION` in `packages/engine/src/params.ts`. Every tunable number lives
in that file next to its source. If you change one, bump `MODEL_VERSION` and update the golden
tests. Old share links still open; the app tells the viewer that the numbers may differ.

## What is computed and what is fixed

| Stage | How | Why |
|---|---|---|
| Mouth | Eating time from portion size (about 35 g/min for solids, about 1 min for a drink) | Illustrative assumption |
| Oesophagus | About 8 s | OpenStax A&P 2e §23.3: 4–8 s for solids, about 1 s for liquids |
| **Stomach** | **Computed from the meal** | Stomach emptying depends on the food. Everything else depends mostly on the person. |
| Small intestine | Fixed: typically 4 h, range 3–5.7 h | OpenStax §23.5 (3–5 h); Nandhra et al. 2023 capsule reference range |
| Large intestine | Fixed: typically 22 h, range 12–29 h | OpenStax §23.5 (12–24 h); Nandhra et al. 2023 (study means 16–29 h) |
| **Blood glucose** | **Computed from the meal** | From carbohydrate, glycemic index, emptying speed, protein and fat |

### Stomach emptying

The meal is split into a **liquid** phase and a **solid** phase. For each phase, the fraction still
in the stomach is a power-exponential (Elashoff et al. 1982):

```
retention(t) = 2^-((t / t½)^β)
```

**Liquids** use β = 1, which is a simple exponential. Their half-time is
`max(16 min, kcal_liquid / (2 × 2.13 kcal/min))`:

- Water empties with a half-time of about 16 min (Ziessman et al. 2009).
- Drinks with calories are held back by the duodenum to about 2.13 kcal/min (Brener et al. 1983).

**Solids** use β = 1.3, which gives the lag-then-steady shape. Their half-time is
`30 min lag + (kcal_solid + kcal_liquid) / (2 × 2.13)`:

- The lag comes from Siegel et al. 1988: 31 ± 8 min for an egg meal.
- The calories of drinks taken with the meal also count, because the small intestine's feedback
  limits **total** calories.
- Fat, protein and carbohydrate slow emptying equally per kcal (Hunt & Stubbs 1975). So fat-rich
  meals empty slowly simply because they carry more kcal per gram.

**Golden test:** a standard 255 kcal solid meal stays within the consensus normal ranges for
scintigraphy (Abell et al. 2008). It must have 37–90 % left at 1 h, 30–60 % at 2 h and ≤10 % at 4 h.

### Intestines

Each intestine is a fixed-delay pipe, using the typical transit times above. While food is in the
small intestine, this share of each nutrient is absorbed (OpenStax §23.7):

| Nutrient | Absorbed in small intestine |
|---|---|
| Carbohydrate | 95 % |
| Protein | 90 % |
| Fat | 95 % |
| Water | 80 % |
| Fibre | 0 % |

The colon absorbs 90 % of the water that reaches it. Mass is conserved: there is a test for it.

### Blood glucose

1. As carbohydrate leaves the stomach, it is weighted by its glycemic index.
2. Fat and protein then blunt it by `1 / (1 + 0.15 × (2·protein + fat) / carbs)`, with a floor of
   0.6. Protein counts twice as much as fat, gram for gram (Moghaddam et al. 2006).
3. It is absorbed with a 10-minute time constant.
4. Plasma glucose rises, and is pulled back by baseline clearance plus an insulin-action term that
   builds up while glucose is raised. That structure follows the Bergman minimal model (1979).

A food's GI is measured on the whole food, so it already includes that food's own stomach
emptying. To avoid counting the slow emptying of solids twice, a single correction factor is
calibrated so that simulated white bread (GI 75) gives 75 % of the 2-hour glucose area of 50 g
glucose. That is the definition of GI (Brouns et al. 2005).

**Golden tests:**

- 50 g glucose peaks at +30–60 mg/dL within 30–60 min and is near baseline by 2 h. Real meals peak
  at about 46–50 min (Freckmann et al. 2007).
- Fat and protein flatten the curve.
- Water does nothing.

The display is a **band**, not a number: 0.65× to 1.45× the typical curve. This reflects how much
glycemic responses differ between people.

## Known limits

- It models a healthy adult only. It does not model children, pregnancy, diabetes or digestive
  illness.
- Milk clots in the stomach and really empties more slowly than the liquid model shows.
- Glycemic-index values vary between studies and varieties (rice: about 50 to over 90).
- Peaks for solid meals come out somewhat later and lower than continuous-glucose-monitor data. The
  model leans conservative.
- Most constants in the β and insulin terms are calibrated to the golden tests, not measured.
  `params.ts` marks which is which.

## References

1. Abell TL, et al. Consensus recommendations for gastric emptying scintigraphy. *Am J Gastroenterol* 2008;103:753–763.
2. Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index and glycemic load values: 2008. *Diabetes Care* 2008;31:2281–2283.
3. Bergman RN, et al. Quantitative estimation of insulin sensitivity. *Am J Physiol* 1979;236:E667–E677.
4. Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. *Gastroenterology* 1983;85:76–82.
5. Brouns F, et al. Glycaemic index methodology. *Nutr Res Rev* 2005;18:145–171.
6. Elashoff JD, Reedy TJ, Meyer JH. Analysis of gastric emptying data. *Gastroenterology* 1982;83:1306–1312.
7. Freckmann G, et al. Continuous glucose profiles in healthy subjects. *J Diabetes Sci Technol* 2007;1:695–703.
8. Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. *J Physiol* 1975;245:209–225.
9. Moghaddam E, Vogt JA, Wolever TMS. Effects of fat and protein on glycemic responses. *J Nutr* 2006;136:2506–2511.
10. Nandhra GK, et al. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. *J Clin Med* 2023;12:5272.
11. OpenStax. *Anatomy and Physiology 2e*, ch. 23. Rice University.
12. Siegel JA, et al. Biphasic nature of gastric emptying. *Gut* 1988;29:85–89.
13. Wang YT, et al. Regional gastrointestinal transit and pH in 215 healthy volunteers. *Aliment Pharmacol Ther* 2015;42:761–772.
14. Ziessman HA, et al. Liquid gastric emptying. *J Nucl Med* 2009;50:726–731.

The food data comes from USDA FoodData Central (SR Legacy), the Indian Nutrient Databank
(Vijayakumar et al. 2024, built on IFCT 2017) and Atkinson et al. 2008. Each food file cites its own
sources.

**Still needed:** sign-off from a named physiology or biology reviewer before the pilot with
teachers.
