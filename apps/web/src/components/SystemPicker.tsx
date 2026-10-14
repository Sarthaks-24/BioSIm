import { useRef, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActivityBout, type RunResult, type SignalMeta, type SignalStatus } from '@lifepeek/engine'
import type { TFunction } from 'i18next'
import picker from 'virtual:lifepeek-en/picker'
import lifeProcess from 'virtual:lifepeek-en/lifeProcess'
import units from 'virtual:lifepeek-en/units'
import restingBody from '../assets/resting-body.svg'
import { addEnglish } from '../i18n/text.ts'
import type { GraphSlotDef, SystemId } from '../systems/registry.ts'
import { useClock } from '../state/clock.ts'
import { StatusTag } from './kit/index.ts'
import Overlay from './Overlay.tsx'

addEnglish(picker, lifeProcess, units)

/**
 * The picker's groups, in NCERT order with the core four first (ui-ux §3.1): each a life process
 * and its rows. Only the rows offered show (public, or a preview's); a group with none is left out,
 * and nothing is shown as "coming soon".
 */
const GROUPS: readonly (readonly [string, readonly SystemId[]])[] = [
  ['nutrition', ['digestion']],
  ['respiration', ['breathing']],
  ['transport', ['circulation', 'lymph']],
  ['excretion', ['kidneys']],
  ['control', ['nerves', 'hormones']],
  ['movement', ['muscles', 'bones', 'skin']],
  ['reproduction', ['reproduction']],
]

/**
 * The body-system picker (U-2; ui-ux §3.2), downloaded the first time the title opens it or is
 * pointed at (≤ 6 KB gz, runtime cache "lp-lazy"): from 1024 px up a popover by the title with a
 * small body beside the grouped list (two columns on the projector); below, a sheet with the list
 * only (FP-5's Overlay). It gets the rows, their values and what picking does from the title, so it
 * shares no code with the stage.
 *
 * Row = name · its first graph's value at the clock's minute ("15 breaths a minute, walking", or
 * "same as at the start") · how sure we are. ↑ ↓ Home End move between rows; Enter lights one; Esc,
 * Back or Close shut it, and focus goes back to the title. The lit row is marked as current.
 */
export default function SystemPicker({
  anchor,
  onClose,
  rows,
  lit,
  onPick,
  run,
  first,
  tag,
  format,
  doing,
}: {
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  rows: readonly SystemId[]
  lit: SystemId
  onPick: (id: SystemId) => void
  run: RunResult
  /** A row's first graph, once its pack has brought its graphs (systems/registry.ts). */
  first: (id: SystemId) => GraphSlotDef | undefined
  /** A row with no value, its tag: Drawing only (R11: lymph's map and card), or the nerve demo's Model estimate (U-7). */
  tag: (id: SystemId) => SignalStatus | undefined
  /** The stage's own number writer and bout reader (lib/formatSignal.ts, lib/bouts.ts), handed in. */
  format: (value: number, meta: SignalMeta, t: TFunction, lang: string) => string
  doing: (bouts: readonly ActivityBout[], min: number) => string
}) {
  const { t, i18n } = useTranslation()
  // A row's value (ui-ux §3.2): its first graph's line at the clock's minute when the picker opens
  // (never per frame), or "same as at the start" within 1 %; none until its graphs have loaded.
  const min = useClock.getState().simMin
  const now = doing(run.activity, min)
  const value = (id: SystemId) => {
    const slot = first(id)
    const series = slot && run.signals.get(slot.signals[0])
    if (!series) return null
    const v = valueAt(series, min, run.stepMin)
    const start = series.values[0]!
    return {
      status: series.meta.status,
      text: Math.abs(v - start) > 0.01 * Math.abs(start) ? format(v, series.meta, t, i18n.language) : null,
    }
  }
  const list = useRef<HTMLDivElement>(null)
  // ↑ ↓ Home End between the rows (Tab goes through them too).
  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[data-system-row]') ?? [])]
    const to = { ArrowDown: 1, ArrowUp: -1, Home: -buttons.length, End: buttons.length }[e.key]
    if (to === undefined || !buttons.length) return
    e.preventDefault()
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[Math.min(buttons.length - 1, Math.max(0, at + to))]!.focus()
  }
  return (
    <Overlay anchor={anchor} onClose={onClose} label={t('picker.title')} width="w-[20rem]" menu>
      <div className="flex gap-4">
        <img src={restingBody} alt="" width="72" className="h-auto self-start max-lg:hidden" />
        <div ref={list} onKeyDown={onKeyDown} className="grid min-w-0 flex-1 gap-3">
          {GROUPS.map(([group, ids]) => {
            const shown = rows.filter((id) => ids.includes(id))
            if (!shown.length) return null
            return (
              <section key={group} aria-label={t(`lifeProcess.${group}`)} className="grid gap-1">
                <h3 className="text-caption font-semibold text-ink-muted">
                  {t(`lifeProcess.${group}`)}
                  {/* The teacher switch's row shows only while it is on, and says so (R-1, ui-ux §10). */}
                  {group === 'reproduction' && (
                    <span
                      data-switch-on=""
                      className="rounded-control border border-border px-1 font-normal"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {t('picker.switchOn')}
                    </span>
                  )}
                </h3>
                <ul className="grid gap-1">
                  {shown.map((id) => {
                    const v = value(id)
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          data-system-row={id}
                          aria-current={id === lit ? 'true' : undefined}
                          onClick={() => onPick(id)}
                          className={`flex min-h-11 w-full flex-wrap items-center gap-x-2 rounded-control px-2 py-1 text-left hover:bg-surface-sunk lg:min-h-9 ${
                            id === lit ? 'bg-surface-sunk font-semibold' : ''
                          }`}
                        >
                          <span className="text-control text-ink">{t(`systems.${id}.name`)}</span>
                          {!v && tag(id) && (
                            <span className="ml-auto">
                              <StatusTag status={tag(id)!} quiet />
                            </span>
                          )}
                          {v && (
                            <>
                              <span className="tabular text-caption text-ink-muted">
                                {v.text ?? t('picker.same')}
                                {now !== 'rest' && `, ${t(`picker.doing.${now}`)}`}
                              </span>
                              <span className="ml-auto">
                                <StatusTag status={v.status} quiet />
                              </span>
                            </>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </Overlay>
  )
}
