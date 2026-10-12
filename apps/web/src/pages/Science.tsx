import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@biosim/engine'
import { FOODS } from '../data/foods.ts'
import { localized } from '../i18n/index.ts'

/** Every model reference, in one place. Keep in sync with packages/engine/src/params.ts. */
const REFERENCES = [
  'Abell TL, Camilleri M, Donohoe K, et al. Consensus recommendations for gastric emptying scintigraphy. Am J Gastroenterol 2008;103(3):753–763.',
  'Atkinson FS, Foster-Powell K, Brand-Miller JC. International tables of glycemic index and glycemic load values: 2008. Diabetes Care 2008;31(12):2281–2283.',
  'Bergman RN, Ider YZ, Bowden CR, Cobelli C. Quantitative estimation of insulin sensitivity. Am J Physiol 1979;236(6):E667–E677.',
  'Brener W, Hendrix TR, McHugh PR. Regulation of the gastric emptying of glucose. Gastroenterology 1983;85(1):76–82.',
  'Brouns F, Bjorck I, Frayn KN, et al. Glycaemic index methodology. Nutr Res Rev 2005;18(1):145–171.',
  'Elashoff JD, Reedy TJ, Meyer JH. Analysis of gastric emptying data. Gastroenterology 1982;83(6):1306–1312.',
  'Freckmann G, Hagenlocher S, Baumstark A, et al. Continuous glucose profiles in healthy subjects under everyday life conditions and after different meals. J Diabetes Sci Technol 2007;1(5):695–703.',
  'Hunt JN, Stubbs DF. The volume and energy content of meals as determinants of gastric emptying. J Physiol 1975;245(1):209–225.',
  'Moghaddam E, Vogt JA, Wolever TMS. The effects of fat and protein on glycemic responses in nondiabetic humans. J Nutr 2006;136(10):2506–2511.',
  'Nandhra GK, Chaichanavichkij P, Birch M, Scott SM. Gastrointestinal transit times in health as determined using ingestible capsule systems: a systematic review. J Clin Med 2023;12(16):5272.',
  'OpenStax. Anatomy and Physiology 2e, chapter 23: The Digestive System. Rice University, 2022.',
  'Siegel JA, Urbain JL, Adler LP, et al. Biphasic nature of gastric emptying. Gut 1988;29(1):85–89.',
  'Wang YT, Mohammed SD, Farmer AD, et al. Regional gastrointestinal transit and pH studied in 215 healthy volunteers using the wireless motility capsule. Aliment Pharmacol Ther 2015;42(6):761–772.',
  'Ziessman HA, Chander A, Clarke JO, Ramos A, Wahl RL. The added diagnostic value of liquid gastric emptying compared with solid emptying alone. J Nucl Med 2009;50(5):726–731.',
]

export default function Science() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-extrabold tracking-tight">{t('science.title')}</h1>
      <p className="mt-4 text-lg text-ink-2">{t('science.lead')}</p>
      <p className="tabular mt-2 text-sm text-ink-2">{t('science.version', { version: MODEL_VERSION })}</p>

      <h2 className="mt-10 mb-2 text-2xl font-extrabold">{t('science.modelTitle')}</h2>
      <p>{t('science.modelBody')}</p>
      <h2 className="mt-8 mb-2 text-2xl font-extrabold">{t('science.fixedTitle')}</h2>
      <p>{t('science.fixedBody')}</p>
      <h2 className="mt-8 mb-2 text-2xl font-extrabold">{t('science.limitsTitle')}</h2>
      <ul className="list-disc space-y-1 pl-6">
        {(t('science.limits', { returnObjects: true }) as string[]).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h2 className="mt-10 mb-4 text-2xl font-extrabold">{t('science.foodsTitle')}</h2>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th scope="col" className="py-2 pr-3">
                {t('lesson.meal')}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t('science.nutrientsPerServing')}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t('science.gi')}
              </th>
              <th scope="col" className="py-2">
                {t('science.references')}
              </th>
            </tr>
          </thead>
          <tbody>
            {FOODS.map((f) => (
              <tr key={f.id} className="border-b border-rule align-top">
                <th scope="row" className="py-3 pr-3 text-left">
                  <span aria-hidden="true">{f.emoji} </span>
                  {localized(f.name, lang)}
                  <span className="block font-normal text-ink-2">{localized(f.serving.label, lang)}</span>
                </th>
                <td className="py-3 pr-3">
                  {f.nutrients.energyKcal} kcal · {t('nutrients.carbs')} {f.nutrients.carbsG} g · {t('nutrients.protein')}{' '}
                  {f.nutrients.proteinG} g · {t('nutrients.fat')} {f.nutrients.fatG} g · {t('nutrients.fiber')} {f.nutrients.fiberG} g
                  {f.notes && <span className="mt-1 block text-ink-2">{localized(f.notes, lang)}</span>}
                </td>
                <td className="py-3 pr-3">{f.glycemicIndex ? f.glycemicIndex.value : t('science.noGi')}</td>
                <td className="py-3">
                  <ul className="space-y-1">
                    {f.sources.map((s) => (
                      <li key={s.citation}>
                        {s.url ? (
                          <a href={s.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                            {s.label}
                          </a>
                        ) : (
                          s.label
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-4 text-2xl font-extrabold">{t('science.references')}</h2>
      <ol className="list-decimal space-y-2 pl-6 text-sm">
        {REFERENCES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-ink-2">{t('disclaimer.long')}</p>
    </article>
  )
}
