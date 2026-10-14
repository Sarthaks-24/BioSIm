import { SOURCES } from '@lifepeek/engine'
import { NERVE_SOURCES } from '@lifepeek/engine/demo'

/**
 * Fuller citations than the engine's source registry keeps (packages/engine/src/core/sources.ts),
 * by source ID. A registered source without one here is listed with the registry's citation.
 */
const FULL_CITATION: Record<string, string> = {
  abell2008:
    'Abell TL, Camilleri M, Donohoe K, et al. Consensus recommendations for gastric emptying scintigraphy. Am J Gastroenterol 2008;103(3):753–763.',
  atkinson2008:
    'Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index and glycemic load values: 2008. Diabetes Care 2008;31(12):2281–2283.',
  bergman1979:
    'Bergman RN, Ider YZ, Bowden CR, Cobelli C. Quantitative estimation of insulin sensitivity. Am J Physiol 1979;236(6):E667–E677.',
  brener1983: 'Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. Gastroenterology 1983;85(1):76–82.',
  brouns2005: 'Brouns F, Bjorck I, Frayn KN, et al. Glycaemic index methodology. Nutr Res Rev 2005;18(1):145–171.',
  elashoff1982: 'Elashoff JD, Reedy TJ, Meyer JH. Analysis of gastric emptying data. Gastroenterology 1982;83(6):1306–1312.',
  freckmann2007:
    'Freckmann G, Hagenlocher S, Baumstark A, et al. Continuous glucose profiles in healthy subjects under everyday life conditions and after different meals. J Diabetes Sci Technol 2007;1(5):695–703.',
  hunt1975:
    'Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. J Physiol 1975;245(1):209–225.',
  moghaddam2006:
    'Moghaddam E, Vogt JA, Wolever TMS. The effects of fat and protein on glycemic responses in nondiabetic humans. J Nutr 2006;136(10):2506–2511.',
  nandhra2023:
    'Nandhra GK, Chaichanavichkij P, Birch M, Scott SM. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. J Clin Med 2023;12(16):5272.',
  'openstax-ap2e-23': 'OpenStax. Anatomy and Physiology 2e, chapter 23: The Digestive System. Rice University, 2022.',
  siegel1988: 'Siegel JA, Urbain JL, Adler LP, et al. Biphasic nature of gastric emptying. Gut 1988;29(1):85–89.',
  wang2015:
    'Wang YT, Mohammed SD, Farmer AD, et al. Regional gastrointestinal transit and pH studied in 215 healthy volunteers using the wireless motility capsule. Aliment Pharmacol Ther 2015;42(6):761–772.',
  ziessman2009:
    'Ziessman HA, Chander A, Clarke JO, Ramos A, Wahl RL. The added diagnostic value of liquid gastric emptying compared with solid emptying alone. J Nucl Med 2009;50(5):726–731.',
}

/**
 * Every model reference, in one place: each registered source (its ID is the anchor the graphs'
 * "How we know" links to, /science#freckmann2007), the nerve demo's (V-7: its own registry, in the
 * demo's lazy entry, not the engine's main one) and Elashoff 1982, which the v1 model notes cite.
 */
export const REFERENCES: { id: string; citation: string; url?: string }[] = [
  ...Object.entries(SOURCES).map(([id, s]) => ({ id, citation: FULL_CITATION[id] ?? s.citation, ...('url' in s ? { url: s.url } : {}) })),
  ...Object.entries(NERVE_SOURCES).map(([id, s]) => ({ id, citation: s.citation, url: s.url })),
  { id: 'elashoff1982', citation: FULL_CITATION.elashoff1982! },
].sort((a, b) => a.citation.localeCompare(b.citation, 'en'))
