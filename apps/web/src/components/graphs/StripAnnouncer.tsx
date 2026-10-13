import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type RunResult } from '@lifepeek/engine'
import { formatSignal } from '../../lib/formatSignal.ts'
import { formatDuration } from '../../lib/time.ts'
import { useClock } from '../../state/clock.ts'
import type { Slot } from '../stage/GraphColumn.tsx'

/** How long the clock must stay still before the graphs' values are read out (ms). */
const SETTLE_MS = 700

/** The mounted announcer's voice, for the key map (pages/Simulator.tsx): null while no stage is open. */
let voice: { say: (text: string) => void; readSlot: (slot: string) => void } | null = null

/**
 * Says `text` in the graphs' live region (a key press's result: "Kept: Cola"). Emptied first and
 * filled a moment later, so the same words twice are said twice.
 */
export const announce = (text: string) => voice?.say(text)

/** Reads out one graph's values now ("Blood sugar 110 mg/dL, kept meal 95 mg/dL"), after S, B or E. */
export const readOutSlot = (slot: string) => voice?.readSlot(slot)

/**
 * One polite live region for the graphs (G8): when the clock stops (Pause, the end, a key moment,
 * a drag or arrow keys that have ended), screen readers hear the time and each shown graph's
 * value, this meal's and the kept one's: "1 h after eating: Food in the stomach 120 g, kept 230 g".
 * Never while playing, and never per frame (that would talk over everything). Written straight
 * into the element, outside React, like the readouts. The kept value only for a graph's main line:
 * the second line (energy used at rest) is the same for every meal and has no kept line
 * (review 15, LOW 7). The key map speaks here too (P, S, B, E: `announce`, `readOutSlot`).
 */
export default function StripAnnouncer({
  slots,
  shown,
  run,
  kept,
}: {
  /** Every graph of the lit layer (S, B and E can ask for one that is not in view). */
  slots: readonly Slot[]
  /** The graphs in view. */
  shown: readonly Slot[]
  run: RunResult
  kept: RunResult | null
}) {
  const { t, i18n } = useTranslation()
  const region = useRef<HTMLParagraphElement>(null)
  const lang = i18n.language

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const readout = (from: readonly Slot[]) => {
      const { simMin } = useClock.getState()
      const parts = from.flatMap((slot) =>
        slot.signals.flatMap((id, i) => {
          const s = run.signals.get(id)
          if (!s) return []
          const k = i === 0 ? kept?.signals.get(id) : undefined
          const value = (series: typeof s, sim: RunResult) => formatSignal(valueAt(series, simMin, sim.stepMin), series.meta, t, lang)
          const own = `${t(`${s.meta.i18nKey}.name`)} ${value(s, run)}`
          return [k && kept ? `${own}, ${t('table.keptValue', { value: value(k, kept) })}` : own]
        }),
      )
      return `${formatDuration(simMin, t)} ${t('sim.afterEating')}: ${parts.join('; ')}.`
    }
    const say = () => {
      if (useClock.getState().playing || !region.current) return
      region.current.textContent = readout(shown)
    }
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(say, SETTLE_MS)
    }
    voice = {
      say: (text) => {
        clearTimeout(timer)
        const el = region.current
        if (!el) return
        el.textContent = ''
        // Not cancelled when this effect runs again (S switches the graph in view): the region stays.
        setTimeout(() => (el.textContent = text), 80)
      },
      readSlot: (id) => {
        const slot = slots.find((s) => s.id === id)
        voice?.say(readout(slot ? [slot] : shown))
      },
    }
    // Only changes made after this point: opening a link that sets the time says nothing.
    const offTime = useClock.subscribe(
      (s) => s.simMin,
      () => !useClock.getState().playing && later(),
    )
    const offPlay = useClock.subscribe(
      (s) => s.playing,
      (playing) => (playing ? clearTimeout(timer) : later()),
    )
    return () => {
      clearTimeout(timer)
      offTime()
      offPlay()
      voice = null
    }
  }, [slots, shown, run, kept, t, lang])

  return <p ref={region} role="status" data-announcer="" className="sr-only" />
}
