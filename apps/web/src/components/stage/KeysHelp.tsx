import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeys } from '../../lib/keys.ts'
import { useMotion } from '../../state/motion.ts'
import { useRunStore } from '../../state/run.ts'
import { DEFAULT_SYSTEM, systemOf, teacherSwitch } from '../../systems/registry.ts'
import Sheet from './Sheet.tsx'

/** The key map's rows, in the order of lib/keys.ts, each with what it does. */
const ROWS: readonly { keys: readonly string[]; what: string; letter?: boolean }[] = [
  { keys: ['Space', 'K'], what: 'keys.play', letter: true },
  { keys: ['←', '→'], what: 'keys.move' },
  { keys: ['Shift + ←', 'Shift + →'], what: 'keys.moveHour' },
  { keys: ['Page Down', 'Page Up'], what: 'keys.moments' },
  { keys: ['Home', 'End'], what: 'keys.ends' },
  { keys: ['P'], what: 'keys.keep', letter: true },
  { keys: ['T'], what: 'keys.table', letter: true },
  { keys: ['1', '2', '3'], what: 'keys.slots', letter: true },
  { keys: ['S', 'B', 'E'], what: 'keys.strips', letter: true },
  { keys: ['[', ']'], what: 'keys.systems', letter: true },
  { keys: ['L'], what: 'keys.picker', letter: true },
  { keys: ['?'], what: 'keys.help', letter: true },
]

/**
 * Settings (G8 + UI-6, UI-7; named so, FP-3 U10): two switches saved on this device, then the
 * stage's keys, which a touch screen (coarse pointer) does not list.
 * - Letter keys (WCAG 2.1.4): one-character shortcuts can get in the way of a screen reader or
 *   voice control, so they can be switched off (`lifepeek:keysOff`). Arrows, Page Up / Down, Home
 *   and End keep working: a clicker needs them.
 * - Reduce motion (`lifepeek:reduceMotion`, state/motion.ts): follows the device until chosen
 *   here, since school computers rarely let pupils change the system setting.
 * - Growing up (R-1, ui-ux §10): the teacher switch that adds the Reproduction row, off by default
 *   and for this tab only (systems/registry.ts `teacherSwitch` says why). Listed only once that row
 *   may be offered at all (public since R117, or a `?preview=1` session); switched off while lit,
 *   the stage goes back to Digestion.
 * Opened with ? or the dock's settings button; downloaded the first time (pages/Simulator.tsx).
 */
export default function KeysHelp() {
  const { t } = useTranslation()
  const keysOff = useKeys((s) => s.off)
  const reduced = useMotion((s) => s.reduced)
  const choice = useMotion((s) => s.choice)
  const preview = useRunStore((s) => s.preview)
  const repro = systemOf('reproduction')
  const [growingUp, setOn] = useState(teacherSwitch.on)
  const switchGrowingUp = (on: boolean) => {
    setGrowingUp(on)
    setOn(on)
    const { layer, setLayer } = useRunStore.getState()
    if (!on && systemOf(layer)?.teacherSwitch) setLayer(DEFAULT_SYSTEM)
  }
  return (
    <Sheet title={t('keys.title')}>
      <section aria-labelledby="keys-settings" className="flex flex-col gap-3">
        <h3 id="keys-settings" className="sr-only">
          {t('keys.settings')}
        </h3>
        <Switch
          on={reduced}
          onChange={(on) => useMotion.getState().setChoice(on)}
          label={t('keys.motion')}
          help={choice === null ? `${t('keys.motionHelp')} ${t('keys.motionDevice')}` : t('keys.motionHelp')}
        />
        {choice !== null && (
          <button
            type="button"
            onClick={() => useMotion.getState().setChoice(null)}
            className="-mt-1 self-start rounded-control px-1 text-caption font-semibold text-ink underline underline-offset-4 hover:bg-surface-sunk"
          >
            {t('keys.motionReset')}
          </button>
        )}
        <Switch on={!keysOff} onChange={(on) => useKeys.getState().setOff(!on)} label={t('keys.letters')} help={t('keys.lettersHelp')} />
        {repro && (repro.public || preview) && (
          <Switch on={growingUp} onChange={switchGrowingUp} label={t('keys.growingUp')} help={t('keys.growingUpHelp')} />
        )}
      </section>
      {/* No key list on a touch screen (U10): it has no keys, and Reduce motion comes first there. */}
      <section aria-labelledby="keys-list" className="mt-4 border-t border-border pt-3 pointer-coarse:hidden">
        <h3 id="keys-list" className="font-semibold">
          {t('keys.list')}
        </h3>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          {ROWS.map((row) => (
            <div key={row.what} className={`contents ${row.letter && keysOff ? '[&>*]:opacity-55' : ''}`}>
              <dt className="flex flex-wrap items-center gap-1">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    translate="no"
                    className="tabular rounded-[4px] border border-border border-b-2 bg-surface-page px-1.5 py-px font-sans text-caption font-semibold whitespace-nowrap text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="self-center">
                {t(row.what)}
                {row.letter && keysOff && <span className="text-ink-muted"> ({t('keys.offNote')})</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-ink-muted">{t('keys.typing')}</p>
      </section>
    </Sheet>
  )
}

/** Turns the teacher switch on or off for this tab (its state: systems/registry.ts `teacherSwitch`). */
function setGrowingUp(on: boolean) {
  teacherSwitch.on = on
  try {
    if (on) sessionStorage.setItem('lifepeek:growingUp', '1')
    else sessionStorage.removeItem('lifepeek:growingUp')
  } catch {
    // Kept for this page only (a blocked browser): the switch still works until it is closed.
  }
}

/** An on/off switch: its name, a line saying what it does, and the state in words and shape. */
function Switch({ on, onChange, label, help }: { on: boolean; onChange: (on: boolean) => void; label: string; help: string }) {
  const { t } = useTranslation()
  const id = useId()
  const helpId = `${id}-help`
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p id={id} className="font-semibold">
          {label}
        </p>
        <p id={helpId} className="text-caption text-ink-muted">
          {help}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        aria-describedby={helpId}
        onClick={() => onChange(!on)}
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-control px-2 font-semibold hover:bg-surface-sunk lg:min-h-9"
      >
        {/* The state in words for the eye; screen readers hear it from aria-checked. */}
        <span aria-hidden="true" className="min-w-[3ch] text-right text-caption">
          {on ? t('keys.on') : t('keys.off')}
        </span>
        {/* The track: filled ink when on, an outline when off; the knob moves too (never colour alone). */}
        <span
          aria-hidden="true"
          className={`relative h-6 w-10 rounded-full border-2 border-ink transition-colors motion-reduce:transition-none ${on ? 'bg-ink' : 'bg-surface-raised'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full transition-transform motion-reduce:transition-none ${on ? 'translate-x-4 bg-surface-raised' : 'bg-ink'}`}
          />
        </span>
      </button>
    </div>
  )
}
