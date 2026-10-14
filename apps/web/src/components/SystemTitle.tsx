import { Suspense, useEffect, useRef, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import type { RunResult } from '@lifepeek/engine'
import { activityKindAt } from '../lib/bouts.ts'
import { formatSignal } from '../lib/formatSignal.ts'
import { useRunStore } from '../state/run.ts'
import { pickerSystems, stepSystem, systemOf, useTeacherSwitch } from '../systems/registry.ts'
import { announce } from './graphs/StripAnnouncer.tsx'
import { LoadBoundary, LoadFailedBox, lazyWithRetry } from './LoadBoundary.tsx'
import { ChevronDownIcon } from './kit/index.ts'
import type SystemPicker from './SystemPicker.tsx'

/**
 * The picker loads the first time it opens, or is pointed at (R71, R74: lazy, in the runtime cache).
 * It gets everything from here (props), so it shares no module with the stage: a shared one would
 * be split into a chunk of its own, on /sim's first download.
 */
const load = () => import('./SystemPicker.tsx')
const picker = lazyWithRetry<ComponentProps<typeof SystemPicker>>(load)
const prefetch = () => void load().catch(() => {})

/** Whether the picker is open: the title opens it, and so does L (pages/Simulator.tsx). */
export const usePicker = create<{ open: boolean }>(() => ({ open: false }))
export const openPicker = () => usePicker.setState({ open: true })

/**
 * Lights the picker's row before (−1) or after (+1) the lit one: `‹ ›`, and [ and ] (ui-ux §3.2).
 * While a row is on its way, from that row: pressed quickly, each press moves on (R120 #6).
 */
export function stepLayer(dir: 1 | -1) {
  const { layer, preview, switching, setLayer } = useRunStore.getState()
  setLayer(stepSystem(switching && !switching.failed ? switching.to : layer, preview, dir))
}

/** How long a pack may load before the title says it is on its way (it usually arrives sooner), and before it adds that the connection is slow (R71). */
const SAY_MS = 300
const SLOW_MS = 6000

/**
 * The body pane's title (U-2; ui-ux §3.2): the lit system's name with ▾, top-left over the empty
 * paper beside the head, the button that opens the picker (lazy, in FP-5's Overlay). From 1024 px
 * up `‹ ›` beside it step through the picker's rows. It is the only picker code in the first paint.
 *
 * While a system's pack loads the lit one stays drawn, and the title says "Getting the lungs
 * ready…"; after 6 s that the connection is slow; if it fails, that it could not, with Try again
 * (R71: the screen is never cleared). On a phone the title shows only when there is more than one
 * row to pick: until breathing is public that is never, so a phone's body keeps all its room. The
 * button's finger-sized target is its ::after, so its box covers little of the body.
 */
export default function SystemTitle({ run }: { run: RunResult }) {
  const { t } = useTranslation()
  const layer = useRunStore((s) => s.layer)
  const preview = useRunStore((s) => s.preview)
  const switching = useRunStore((s) => s.switching)
  // The rows follow the teacher switch (pickerSystems reads it). Switched off, the graphs' live
  // region says the system now shown, so its last words never name the row behind it (R120 #3).
  useTeacherSwitch((s) => s.on)
  useEffect(
    () =>
      useTeacherSwitch.subscribe(({ on }) => {
        if (!on) announce(t(`systems.${useRunStore.getState().layer}.name`))
      }),
    [t],
  )
  const open = usePicker((s) => s.open)
  const button = useRef<HTMLButtonElement>(null)
  const [attempt, setAttempt] = useState(0)
  // 0: nothing said yet, 1: "Getting the lungs ready…", 2: the connection is slow.
  const [said, setSaid] = useState(0)
  // Try again was pressed: "Getting the lungs ready…" at once, so the status stays (R120 #12).
  const retried = useRef(false)
  useEffect(() => {
    setSaid(retried.current ? 1 : 0)
    retried.current = false
    if (!switching || switching.failed) return
    const ids = [setTimeout(() => setSaid(1), SAY_MS), setTimeout(() => setSaid(2), SLOW_MS)]
    return () => ids.forEach(clearTimeout)
  }, [switching])
  // A switch that takes the focused control away (the 3D view's "Whole body" when a flat-only row
  // is lit, a graph tab of the old row) puts focus on the title, not on the page (R120 #19). Its
  // new view may come a little later (a lazy pack), so the check waits for the page to change.
  const focused = useRef<Element | null>(null)
  useEffect(
    () =>
      useRunStore.subscribe((s, prev) => {
        if (s.layer !== prev.layer) focused.current = document.activeElement
      }),
    [],
  )
  useEffect(() => {
    const was = focused.current
    focused.current = null
    if (!was || was === document.body) return
    const check = () => {
      if (was.isConnected) return false
      if (document.activeElement === document.body || !document.activeElement) button.current?.focus({ preventScroll: true })
      return true
    }
    if (check()) return
    const watch = new MutationObserver(() => check() && watch.disconnect())
    watch.observe(document.body, { childList: true, subtree: true })
    const stop = setTimeout(() => watch.disconnect(), 5000)
    return () => {
      watch.disconnect()
      clearTimeout(stop)
    }
  }, [layer])
  const rows = pickerSystems(preview)
  const many = rows.length > 1
  const close = () => usePicker.setState({ open: false })
  const name = t(`systems.${layer}.name`)
  const what = switching && t(`systems.${switching.to}.what`)
  const step = (dir: 1 | -1, label: string, glyph: string) =>
    many && (
      <button
        type="button"
        onClick={() => stepLayer(dir)}
        aria-label={label}
        title={label}
        className="grid size-11 place-items-center rounded-control text-title text-ink hover:bg-surface-sunk max-lg:hidden lg:size-9"
      >
        {glyph}
      </button>
    )
  return (
    <div data-system-title={layer} className={`flex flex-col items-start gap-1 ${many ? '' : 'max-lg:hidden'}`}>
      <div className="pointer-events-auto flex items-center">
        {step(-1, t('stage.prevSystem'), '‹')}
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${t('stage.layer')}: ${name}`}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onClick={openPicker}
          data-hit=""
          className="relative flex items-center gap-1 rounded-control px-1.5 text-control font-extrabold text-ink hover:bg-surface-sunk lg:text-title"
        >
          {name}
          <ChevronDownIcon />
        </button>
        {step(1, t('stage.nextSystem'), '›')}
      </div>
      {switching && (switching.failed || said > 0) && (
        <p
          role="status"
          className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-control bg-surface-raised/90 px-1.5 text-caption text-ink-muted"
        >
          {switching.failed
            ? t(navigator.onLine ? 'stage.packFailed' : 'sim.needsInternet', { what })
            : said > 1
              ? t('sim.slow3d')
              : t('stage.packLoading', { what })}
          {switching.failed && (
            <button
              type="button"
              onClick={() => {
                // The button goes away as the pack is asked for again: focus to the title first (R120 #12).
                button.current?.focus()
                retried.current = true
                useRunStore.getState().setLayer(switching.to)
              }}
              className="min-h-11 rounded-control bg-surface-sunk px-3 font-semibold text-ink hover:bg-surface-sunk-hover lg:min-h-9"
            >
              {t('graph.retry')}
            </button>
          )}
        </p>
      )}
      {open && (
        <LoadBoundary
          key={attempt}
          onFail={picker.reset}
          fallback={<LoadFailedBox attempt={attempt} onRetry={() => setAttempt((a) => a + 1)} onClose={close} />}
        >
          <Suspense fallback={null}>
            <picker.Component
              anchor={button}
              onClose={close}
              rows={rows.map((s) => s.id)}
              lit={layer}
              run={run}
              first={(id) => systemOf(id)?.slots[0]}
              tag={(id) => systemOf(id)?.tag ?? (systemOf(id)?.inputs.length ? undefined : 'illustration')}
              format={formatSignal}
              doing={activityKindAt}
              onPick={(id) => {
                useRunStore.getState().setLayer(id)
                announce(t(`systems.${id}.name`))
              }}
            />
          </Suspense>
        </LoadBoundary>
      )}
    </div>
  )
}
