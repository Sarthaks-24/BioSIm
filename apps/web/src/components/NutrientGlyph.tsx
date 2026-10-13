import type { NutrientKind } from '@lifepeek/engine'
import { CARBS_INK, NUTRIENT_COLOR } from '../lib/colors.ts'

/**
 * Same shapes as the 3D/flat particles, so colour is never the only cue. Carbs' yellow dot gets a
 * dark edge of its own ink, as the particles do: the yellow alone is 1.77:1 on paper (FP-4).
 */
export default function NutrientGlyph({ kind, size = 12 }: { kind: NutrientKind; size?: number }) {
  const c = NUTRIENT_COLOR[kind]
  const h = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      {kind === 'carbs' && <circle cx={h} cy={h} r={h * 0.75} fill={c} stroke={CARBS_INK} />}
      {kind === 'protein' && <rect x={size * 0.15} y={size * 0.15} width={size * 0.7} height={size * 0.7} fill={c} />}
      {kind === 'fat' && <polygon points={`${h},0 ${size * 0.9},${h} ${h},${size} ${size * 0.1},${h}`} fill={c} />}
      {kind === 'fiber' && <rect x={size * 0.38} y={0} width={size * 0.24} height={size} fill={c} />}
      {kind === 'water' && <circle cx={h} cy={h} r={h * 0.5} fill={c} opacity={0.75} />}
    </svg>
  )
}
