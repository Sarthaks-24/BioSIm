import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type Simulation } from '@lifepeek/engine'
import { formatSignal } from '../../lib/formatSignal.ts'
import { formatDuration } from '../../lib/time.ts'
import { useClock } from '../../state/clock.ts'

/** How long the clock must stay still before the graphs' values are read out (ms). */
const SETTLE_MS = 700

/**
 * One polite live region for the graphs (G8): when the clock stops (Pause, the end, a key moment,
 * a drag or arrow keys that have ended), screen readers hear the time and each shown graph's
 * value, this meal's and the kept one's: "1 h after eating: Food in the stomach 120 g, kept 230 g".
 * Never while playing, and never per frame (that would talk over everything). Written straight
 * into the element, outside React, like the readouts.
 */
export default function StripAnnouncer({
  signals,
  run,
  kept,
}: {
  signals: readonly ActiveSignalId[]
  run: Simulation
  kept: Simulation | null
}) {
  const { t, i18n } = useTranslation()
  const region = useRef<HTMLParagraphElement>(null)
  const lang = i18n.language

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const say = () => {
      const { simMin, playing } = useClock.getState()
      if (playing || !region.current) return
      const parts = signals.flatMap((id) => {
        const s = run.signals.get(id)
        if (!s) return []
        const k = kept?.signals.get(id)
        const value = (series: typeof s, sim: Simulation) => formatSignal(valueAt(series, simMin, sim.stepMin), series.meta, t, lang)
        const own = `${t(`${s.meta.i18nKey}.name`)} ${value(s, run)}`
        return [k && kept ? `${own}, ${t('table.keptValue', { value: value(k, kept) })}` : own]
      })
      region.current.textContent = `${formatDuration(simMin, t)} ${t('sim.afterEating')}: ${parts.join('; ')}.`
    }
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(say, SETTLE_MS)
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
    }
  }, [signals, run, kept, t, lang])

  return <p ref={region} role="status" data-announcer="" className="sr-only" />
}
