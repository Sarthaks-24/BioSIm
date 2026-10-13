import { useTranslation } from 'react-i18next'
import { NUTRIENT_KINDS } from '@lifepeek/engine'
import NutrientGlyph from './NutrientGlyph.tsx'

export default function Legend() {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2" aria-label={t('charts.where')}>
      {NUTRIENT_KINDS.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <NutrientGlyph kind={k} />
          {t(`nutrients.${k}`)}
        </li>
      ))}
    </ul>
  )
}
