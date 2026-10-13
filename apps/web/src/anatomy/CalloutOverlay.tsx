import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { XYZ } from './spline.ts'
import type { StageId } from '@lifepeek/engine'
import { CALLOUTS, layoutCallouts, type CalloutId, type CalloutInput } from './callouts.ts'

/**
 * The organ labels over a body picture, as plain DOM (crisp, translatable, no WebGL text): a pill
 * per organ, a leader line and a dot on the organ. The 3D body moves them every frame it draws;
 * the flat diagram when its size or the active organ changes. Both lay them out the same way
 * (layoutCallouts), so labels never overlap and never leave the picture, in any language.
 */

export interface CalloutSpec {
  key: CalloutId
  text: string
  /** 'active' = dark pill, 'stage' = light pill, 'context' = faint (organs not on the food's path). */
  tone: 'active' | 'stage' | 'context'
  hidden: boolean
}

const LABEL_STAGES = ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine'] as const satisfies StageId[]
const PRIORITY: Record<CalloutSpec['tone'], number> = { active: 3, stage: 2, context: 1 }

/**
 * Which labels show: the food's path always (on a very narrow picture only the active organ),
 * liver and pancreas only when there is room.
 */
export function useCalloutSpecs(stage: StageId, width: number): CalloutSpec[] {
  const { t } = useTranslation()
  const compact = width < 340
  const roomy = width >= 460
  return [
    ...LABEL_STAGES.map((s) => ({
      key: s,
      text: t(`stages.${s}.short`),
      tone: (s === stage ? 'active' : 'stage') as CalloutSpec['tone'],
      hidden: compact && s !== stage,
    })),
    { key: 'liver' as const, text: t('anatomy.liver'), tone: 'context' as const, hidden: !roomy },
    { key: 'pancreas' as const, text: t('anatomy.pancreas'), tone: 'context' as const, hidden: !roomy },
  ]
}

/** Screen position (CSS px) of a scene point, or null if it is behind the camera. */
export type Project = (p: XYZ) => [number, number] | null

export interface Callouts {
  overlay: ReactNode
  /** Lays the labels out for the current view and moves the DOM. Cheap: call it per drawn frame. */
  place: (project: Project, width: number, height: number) => void
}

/**
 * The label overlay for one picture. `onMeasured` runs when a label's size changes (new language,
 * new active organ), so the picture can lay them out again.
 */
export function useCallouts(specs: CalloutSpec[], onMeasured: () => void): Callouts {
  const labels = useRef<Record<string, HTMLSpanElement | null>>({})
  const leaders = useRef<Record<string, SVGGElement | null>>({})
  const sizes = useRef(new Map<string, { w: number; h: number }>())
  // What each label's DOM shows now, so a frame where nothing moved writes nothing (no restyle).
  const written = useRef(new Map<string, string>())
  const measured = useRef(onMeasured)
  measured.current = onMeasured
  const texts = specs.map((s) => `${s.key}:${s.text}:${s.tone}`).join('|')

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement
        sizes.current.set(el.dataset.callout!, { w: el.offsetWidth, h: el.offsetHeight })
      }
      measured.current()
    })
    for (const el of Object.values(labels.current)) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [texts])

  // The view the labels were last placed for, so new texts can be placed before the browser paints.
  const view = useRef<{ project: Project; width: number; height: number } | null>(null)

  const place = (project: Project, width: number, height: number) => {
    view.current = { project, width, height }
    const items: CalloutInput[] = []
    for (const spec of specs) {
      const box = sizes.current.get(spec.key)
      // A short picture (a phone's, under 200 px) labels only the active organ (FP-1); the narrow
      // one (useCalloutSpecs) did already, so a phone shows at most the active organ and 3 more.
      if (spec.hidden || !box || (height < 200 && spec.tone !== 'active')) continue
      const c = CALLOUTS[spec.key]
      const a = project(c.anchor)
      const l = project(c.at)
      if (!a || !l) continue
      items.push({ key: spec.key, ax: a[0], ay: a[1], lx: l[0], ly: l[1], side: c.side, w: box.w, h: box.h, priority: PRIORITY[spec.tone] })
    }
    const placed = new Map(layoutCallouts(items, width, height).shown.map((b) => [b.key, b]))
    for (const spec of specs) {
      const box = placed.get(spec.key)
      const l = box?.leader
      const signature = box ? `${box.x},${box.y}|${l ? `${l.x1},${l.y1},${l.x2},${l.y2}` : ''}` : ''
      if (written.current.get(spec.key) === signature) continue
      written.current.set(spec.key, signature)
      const el = labels.current[spec.key]
      if (el) {
        el.style.visibility = box ? 'visible' : 'hidden'
        if (box) el.style.transform = `translate(${box.x}px, ${box.y}px)`
      }
      const g = leaders.current[spec.key]
      if (!g) continue
      g.setAttribute('visibility', l ? 'visible' : 'hidden')
      if (!l) continue
      const line = g.firstElementChild!
      line.setAttribute('x1', String(l.x1))
      line.setAttribute('y1', String(l.y1))
      line.setAttribute('x2', String(l.x2))
      line.setAttribute('y2', String(l.y2))
      const dot = g.lastElementChild!
      dot.setAttribute('cx', String(l.x1))
      dot.setAttribute('cy', String(l.y1))
    }
  }

  // A label's text or weight changed (language, active organ): measure and place it now, before
  // the browser paints, so not even one frame shows the old place with the new, wider label.
  useLayoutEffect(() => {
    for (const el of Object.values(labels.current))
      if (el) sizes.current.set(el.dataset.callout!, { w: el.offsetWidth, h: el.offsetHeight })
    const v = view.current
    if (v) place(v.project, v.width, v.height)
  }, [texts]) // eslint-disable-line react-hooks/exhaustive-deps -- runs for new texts only

  const overlay = (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full">
        {specs.map((spec) => (
          <g
            key={spec.key}
            ref={(el) => {
              leaders.current[spec.key] = el
            }}
            visibility="hidden"
            // The projector draws leaders heavier, the active one heaviest (styles.css).
            data-leader={spec.tone}
            className={spec.tone === 'active' ? 'text-ink' : 'text-ink-muted'}
          >
            <line
              stroke="currentColor"
              strokeWidth={spec.tone === 'active' ? 1.5 : 1}
              strokeOpacity={spec.tone === 'context' ? 0.6 : 0.85}
            />
            <circle r={spec.tone === 'active' ? 3.5 : 2.75} fill="currentColor" stroke="white" strokeWidth={1.25} />
          </g>
        ))}
      </svg>
      {specs.map((spec) => (
        <span
          key={spec.key}
          data-callout={spec.key}
          ref={(el) => {
            labels.current[spec.key] = el
          }}
          style={{ visibility: 'hidden' }}
          className={`absolute top-0 left-0 rounded-full px-2 py-0.5 text-xs leading-tight whitespace-nowrap ${TONE_CLASS[spec.tone]}`}
        >
          {spec.text}
        </span>
      ))}
    </div>
  )
  return { overlay, place }
}

const TONE_CLASS: Record<CalloutSpec['tone'], string> = {
  active: 'bg-ink font-semibold text-white shadow-sm',
  stage: 'bg-surface-raised/90 text-ink ring-1 ring-ink/15',
  context: 'bg-surface-raised/80 text-ink-muted ring-1 ring-ink/10',
}
