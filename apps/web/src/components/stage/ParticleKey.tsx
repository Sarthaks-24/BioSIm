import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NUTRIENT_KINDS, type Simulation } from '@lifepeek/engine'
import NutrientGlyph from '../NutrientGlyph.tsx'

/**
 * The key to the food pieces in the body (council round 2): one line, "● Carbohydrate ■ Protein
 * ◆ Fat", only for what this meal has. Same shapes and colours as the 3D and flat particles, so
 * colour is never the only cue. It lies over the bottom of the body, where the legs are.
 */
export default function ParticleKey({ run, className = '' }: { run: Simulation; className?: string }) {
  const { t } = useTranslation()
  const kinds = useMemo(() => NUTRIENT_KINDS.filter((k) => run.particles.some((p) => p.kind === k)), [run])
  if (kinds.length === 0) return null
  return (
    <ul
      aria-label={t('stage.particles')}
      data-particle-key=""
      className={`pointer-events-none flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-ink-2 ${className}`}
    >
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1">
          <NutrientGlyph kind={k} size={11} />
          {t(`nutrients.${k}`)}
        </li>
      ))}
    </ul>
  )
}
