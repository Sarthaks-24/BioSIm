# Data sources

LifePeek's food files (`content/foods/*.json`) contain **only cited inputs**: nutrients per serving,
glycemic index (GI) and their sources. The model computes everything else.

**Values copied from other sources are not licensed by LifePeek.** They stay under their owners'
terms. Our own work around them (the JSON structure, food IDs, names, Hindi names, serving labels,
notes) is CC BY 4.0 (see [LICENSE-CONTENT.md](LICENSE-CONTENT.md)).

## The rule for adding data

> **A few cited values per food, never bulk-copied tables.**

- Copy only the handful of numbers one food needs (energy, carbohydrate, sugars, fibre, protein,
  fat, water, serving weight, GI).
- Cite the exact record for each value (FDC ID, recipe code, table entry) in the food file's `sources`.
- Never import a whole table, a whole database file or a table's layout into the repo.
- Health blogs, apps and AI chat answers are not sources.
- A source whose terms are unclear (marked "permission requested" below) may not be used for
  **new** foods until the permission question is answered.

## Sources at a glance

| Source | Used for | Terms | Status |
|---|---|---|---|
| USDA FoodData Central (SR Legacy 2018) | nutrients and servings for 12 foods | Public domain in the USA, published under CC0 1.0; USDA asks for a citation | OK |
| Indian Nutrient Databank (INDB), Vijayakumar et al. 2024 | nutrients and servings for 3 foods (roti, dal, idli) | GitHub repo has **no licence**; the paper is CC BY 4.0; the values are built on ICMR-NIN IFCT 2017, which is copyrighted | **Permission requested** by email on <date sent, from 00 §6>; values used with citation meanwhile (see 00 D-INDB) |
| ICMR-NIN Indian Food Composition Tables 2017 (IFCT 2017) | not used directly; underlies the INDB values | Copyrighted by ICMR-NIN; reuse terms unknown | **Ask before adding more Indian foods** |
| Atkinson, Foster-Powell & Brand-Miller 2008, International GI tables | GI for 12 foods | Single published facts, cited one value at a time; the table layout is not copied | OK (cited facts) |
| Physiology papers and textbooks (see below) | model constants in `packages/engine/src/params.ts` | Facts and parameters, cited | OK (cited facts) |

## 1. USDA FoodData Central

- Citation: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, SR Legacy (2018). <https://fdc.nal.usda.gov/>
- Terms: FoodData Central data are in the public domain and published under CC0 1.0. USDA asks users to cite it.

| Food file | FDC ID | Record |
|---|---|---|
| `apple.json` | 171688 | Apples, raw, with skin |
| `banana.json` | 173944 | Bananas, raw |
| `boiled-egg.json` | 173424 | Egg, whole, cooked, hard-boiled |
| `cheeseburger.json` | 170320 | Fast foods, cheeseburger; single, regular patty; plain |
| `cola.json` | 174852 | Beverages, carbonated, cola, regular |
| `fries.json` | 170721 | McDONALD'S, french fries |
| `green-salad.json` | 169249, 168409, 170457 | Lettuce, green leaf, raw; Cucumber, with peel, raw; Tomatoes, red, ripe, raw (50 g each) |
| `milk.json` | 171265 | Milk, whole, 3.25% milkfat |
| `orange-juice.json` | 169098 | Orange juice, raw |
| `water.json` | 174158 | Beverages, water, tap, drinking |
| `white-bread.json` | 174924 | Bread, white, commercially prepared |
| `white-rice.json` | 168878 | Rice, white, long-grain, regular, cooked |

Note on `fries.json`: the USDA record is a branded item. The app shows it as plain "French fries"
(फ़्रेंच फ़्राइज़) and the brand name appears only in the citation. "McDonald's" is a trademark of
its owner, and LifePeek has no link with that company. Keep it that way.

## 2. Indian Nutrient Databank (INDB)

- Citation: Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM. Development of an Indian Food
  Composition Database. *Curr Dev Nutr* 2024;8(7):103790. <https://doi.org/10.1016/j.cdnut.2024.103790>
- Repository: <https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB->
- Terms: the paper is open access under CC BY 4.0. The repository has **no licence file**, so
  default copyright applies to it. Its recipe values are calculated mainly from ICMR-NIN IFCT 2017,
  and the README says IFCT data "must be requested from the original source".
- **Status: permission requested** by email on <date>. The reply will be summarised here. If the answer
  is no, the values are replaced within 7 days and the change is listed in `CHANGELOG.md`.
- What we take: one recipe's per-serving values per food. Water is estimated by difference by us.

| Food file | INDB recipe code | Recipe name |
|---|---|---|
| `roti.json` | ASC096 | Chapati/Roti |
| `dal.json` | ASC157 | Whole masoor (Masoor ki dal) |
| `idli.json` | ASC144 | Idli |

If the authors say no, or set terms we can't meet, replace these three foods' values with another
cited source (for example USDA records for similar foods) and say so in `CHANGELOG.md`.

## 3. ICMR-NIN IFCT 2017

- Citation: Longvah T, Ananthan R, Bhaskarachary K, Venkaiah K. *Indian Food Composition Tables 2017*.
  National Institute of Nutrition (ICMR), Hyderabad, 2017.
- Not used directly. Before adding new Indian foods (poha, chai and others) from IFCT 2017,
  ask ICMR-NIN whether a few cited values per food may be reused (contact via <https://www.nin.res.in/>).

## 4. Glycemic index: Atkinson et al. 2008

- Citation: Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index
  and glycemic load values: 2008. *Diabetes Care* 2008;31(12):2281–2283. <https://doi.org/10.2337/dc08-1239>
- Used as single cited facts (one GI value per food). We do not copy the table or its layout.
- Foods: `apple`, `banana`, `cheeseburger`, `cola`, `dal`, `fries`, `idli`, `milk`,
  `orange-juice`, `roti`, `white-bread`, `white-rice`.
  (`boiled-egg`, `green-salad` and `water` have under 5 g carbohydrate, so their GI is `null`.)

## 5. Physiology (model constants)

These are facts and parameters from published research, cited in `docs/MODEL.md` and next to each
constant in `packages/engine/src/params.ts`:

1. Abell TL, et al. Consensus recommendations for gastric emptying scintigraphy. *Am J Gastroenterol* 2008;103:753–763.
2. Atkinson FS, et al. 2008 (above).
3. Bergman RN, et al. Quantitative estimation of insulin sensitivity. *Am J Physiol* 1979;236:E667–E677.
4. Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. *Gastroenterology* 1983;85:76–82.
5. Brouns F, et al. Glycaemic index methodology. *Nutr Res Rev* 2005;18:145–171.
6. Freckmann G, et al. Continuous glucose profiles in healthy subjects. *J Diabetes Sci Technol* 2007;1:695–703.
7. Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. *J Physiol* 1975;245:209–225.
8. Moghaddam E, Vogt JA, Wolever TMS. Effects of fat and protein on glycemic responses. *J Nutr* 2006;136:2506–2511.
9. Nandhra GK, et al. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. *J Clin Med* 2023;12:5272.
10. OpenStax. *Anatomy and Physiology 2e*, ch. 23. Rice University. (CC BY 4.0; we cite facts and don't copy text.)
11. Siegel JA, et al. Biphasic nature of gastric emptying. *Gut* 1988;29:85–89.
12. Wang YT, et al. Regional gastrointestinal transit and pH in 215 healthy volunteers. *Aliment Pharmacol Ther* 2015;42:761–772.
13. Ziessman HA, et al. Liquid gastric emptying. *J Nucl Med* 2009;50:726–731.

## Found a problem with a source?

Open an issue with the food file, the value and the correct source. If you own one of these
sources and want a value removed or credited differently, open an issue or use the contact on the
Privacy page and we will fix it quickly.
