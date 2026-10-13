import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PARAMS, SERVING_STEPS, type MealItem, type ProfileId } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { LoadBoundary, LoadFailed, LoadFailedPanel, lazyWithRetry } from '../LoadBoundary.tsx'
import { FlagIcon, FoodChip, IconButton, MoreIcon } from '../kit/index.ts'
import AddFoodSheet from './AddFoodSheet.tsx'
import KeepButton from './KeepButton.tsx'
import KeptTag, { LineSwatch } from './KeptTag.tsx'
import Popover from './Popover.tsx'
import { mealKcalRounded } from './mealText.ts'

/**
 * The meal bar's other actions (Typical adult, Copy link, Report a mistake; Keep on a phone) are
 * downloaded the first time "⋯" opens: not part of the first paint (FP-1, size budget).
 */
const mealActions = lazyWithRetry<{ profile: ProfileId; keep: ReactNode; report: ReactNode }>(() => import('./MealActions.tsx'))

/** The report form is downloaded on the first click: it is not part of the first paint (size budget). */
const feedbackDialog = lazyWithRetry(() => import('../FeedbackDialog.tsx'))

/**
 * The e2e build's stand-in for v3's activity bouts (`&fixture=bouts`, only where VITE_PSEUDO=1):
 * the three longest bout chips, so the one-row rule is tested with them before they exist (FP-1,
 * B15). The flag is written out, so a real build drops this.
 */
const fixtureBouts = (): Chip[] =>
  import.meta.env.VITE_PSEUDO === '1' && location.search.includes('fixture=bouts')
    ? ['Brisk walking 120 min, from 11:30', 'Skipping rope 105 min, from 10:45', 'Playing football 90 min, from 12:00'].map(
        (text) => () => <FoodChip kind="bout" emoji="🚶" name={text} onRemove={() => {}} />,
      )
    : []

/** One chip of the plan strip, drawn on the strip or (`inline`) in the "+n" list. */
type Chip = (inline?: boolean) => ReactNode

/**
 * The meal bar (UI-13 + UI-3 + UI-10; FP-1's plan strip): the meal as flat chips, "+ Add food" and
 * its kcal, then the kept run, "Keep to compare" and "⋯", on one row at every width (bugs B2, B15):
 * chips that don't fit fold into a "+n" chip (PlanStrip). "⋯" holds whose body it is, "Copy link"
 * and "Report a mistake" (and on a phone, where it has no room on the row, Keep), as a panel under
 * the bar. From 1024 px up the kept run counts as 14 rem, its words wrapping before the line does.
 * The solid and dashed line samples are the key for the graphs: this meal, and the kept one.
 */
export default function MealBar() {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const profile = useRunStore((s) => s.profile)
  const kept = useRunStore((s) => s.kept)
  const [bouts] = useState(fixtureBouts)
  // "⋯": a panel under it (Popover: Esc, a press elsewhere or Tab out closes it, focus comes back).
  const [more, setMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const button = useRef<HTMLButtonElement>(null)

  return (
    <section aria-labelledby="meal-bar-title" className="border-b border-border bg-surface-page">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 lg:min-h-14 lg:gap-x-4 lg:px-4">
        <PlanStrip meal={meal} bouts={bouts} />
        {kept && (
          // On a phone the Now line names the kept meal, with its ✕, right under the meal bar: this
          // row gives way to it while it shows (styles.css), so the body keeps the height (WP-18).
          <div data-kept-tag="" className="flex min-w-0 max-lg:order-last max-lg:basis-full lg:ml-auto lg:max-w-max lg:flex-[1_1_14rem]">
            <KeptTag />
          </div>
        )}
        <div className={`flex shrink-0 items-center gap-1 ${kept ? '' : 'lg:ml-auto'}`}>
          {/* Its words stay after keeping (council SHOULD 11). */}
          <span className="max-lg:hidden">
            <KeepButton />
          </span>
          <IconButton
            ref={button}
            icon={<MoreIcon />}
            label={t('stage.actions')}
            iconOnly
            aria-expanded={more}
            onClick={() => setMore(!more)}
          />
        </div>
      </div>
      {more && (
        // The report form (a <dialog>) opens inside the panel, so the panel stays while it shows.
        <Popover
          anchor={button}
          onClose={() => setMore(false)}
          label={t('stage.actions')}
          className="flex w-[20rem] flex-col items-start gap-1 p-1.5"
        >
          <LoadBoundary
            key={attempt}
            onFail={mealActions.reset}
            fallback={<LoadFailed onRetry={() => setAttempt((a) => a + 1)} attempt={attempt} />}
          >
            <Suspense fallback={null}>
              <mealActions.Component profile={profile} keep={<KeepButton />} report={<ReportMistake />} />
            </Suspense>
          </LoadBoundary>
        </Popover>
      )}
    </section>
  )
}

/**
 * The plan strip (FP-1, ui-ux §2.1): the chips (foods, and from v3 activity bouts: one chip with a
 * `kind`), "+ Add food" and the meal's kcal, on one line at any width. Chips that don't fit fold
 * into one "+n" chip that lists them (bug B15), whatever the width; the first chip always shows,
 * its name shortening before its servings or ✕ (council MUST 9). To fit, every chip is laid out
 * once and measured, and the ones past the room are hidden, before the browser paints.
 */
function PlanStrip({ meal, bouts }: { meal: readonly MealItem[]; bouts: readonly Chip[] }) {
  const { t, i18n } = useTranslation()
  const strip = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const kcal = useRef<HTMLSpanElement>(null)
  // How many chips show, and whether the kcal does; null while everything is laid out to be measured.
  const [fit, setFit] = useState<{ shown: number; kcal: boolean } | null>(null)
  const chips = [...meal.map((item) => (inline?: boolean) => <MealChip item={item} inline={inline} />), ...bouts]
  const n = chips.length
  const hidden = fit ? n - fit.shown : 0
  const total = meal.length > 0 && t('units.kcal', { n: mealKcalRounded(meal) })

  useLayoutEffect(() => setFit(null), [meal, bouts, i18n.language])
  useLayoutEffect(() => {
    if (fit) return
    const box = strip.current!
    const items = [...(list.current?.children ?? [])] as HTMLElement[]
    const gap = (el: Element) => parseFloat(getComputedStyle(el).columnGap) || 0
    // The room for the chips: the strip less what else is on it ("Meal", +, kcal) and their gaps.
    let room = box.clientWidth
    for (const el of box.children as HTMLCollectionOf<HTMLElement>)
      if (el !== list.current && el !== plus.current && el.offsetWidth && getComputedStyle(el).position !== 'absolute')
        room -= el.offsetWidth + gap(box)
    const width = (k: number) =>
      items.slice(0, k).reduce((sum, el, i) => sum + el.offsetWidth + (i ? gap(list.current!) : 0), 0) +
      (k < n ? gap(box) + plus.current!.offsetWidth : 0)
    // A narrow phone: the kcal gives way (the "+n" list says it) before the first chip, its name
    // shortened as far as it goes, would lose its servings.
    const name = items[0]?.querySelector<HTMLElement>('[data-may-shorten]')
    const shortest = name ? width(1) - name.offsetWidth + Math.min(name.offsetWidth, parseFloat(getComputedStyle(name).minWidth)) : 0
    const kcalFits = !kcal.current || shortest <= room
    if (!kcalFits) room += kcal.current!.offsetWidth + gap(box)
    let k = n
    while (k > 1 && width(k) > room + 0.5) k--
    setFit({ shown: k, kcal: kcalFits })
  })
  // Again when the strip's width changes, and when a web font arrives (chips change width).
  useEffect(() => {
    let width = 0
    const again = () => setFit(null)
    const ro = new ResizeObserver(() => {
      if (strip.current && strip.current.clientWidth !== width) {
        width = strip.current.clientWidth
        again()
      }
    })
    ro.observe(strip.current!)
    document.fonts?.addEventListener('loadingdone', again)
    return () => {
      ro.disconnect()
      document.fonts?.removeEventListener('loadingdone', again)
    }
  }, [])

  return (
    <div ref={strip} className="flex min-w-0 flex-1 items-center gap-1.5 lg:max-w-max lg:flex-[1_1_20rem] lg:gap-2">
      <h2 id="meal-bar-title" className="flex shrink-0 items-center gap-2 text-control font-semibold text-ink-muted max-lg:sr-only">
        <LineSwatch />
        {t('stage.meal')}
      </h2>
      {n > 0 && (
        <ul ref={list} className="flex min-w-0 items-center gap-1.5">
          {chips.map((chip, i) => (
            // Measured at its own width; once fitted, the first chip may shorten its name (FoodChip).
            <li key={i} hidden={i >= n - hidden} className={`shrink-0 ${fit ? 'max-w-full' : ''}`}>
              {chip()}
            </li>
          ))}
        </ul>
      )}
      {n > 1 && (
        <button
          ref={plus}
          type="button"
          hidden={!!fit && !hidden}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-h-11 min-w-11 shrink-0 rounded-control bg-surface-sunk px-1.5 text-control font-semibold hover:bg-surface-sunk-hover lg:min-h-9 lg:min-w-9"
        >
          <span className="tabular">+{hidden}</span>
          <span className="sr-only"> {t('stage.moreChips')}</span>
        </button>
      )}
      {open && hidden > 0 && (
        <Popover anchor={plus} onClose={() => setOpen(false)} label={t('stage.meal')} className="w-[20rem]">
          {fit?.kcal === false && <p className="tabular mb-2 text-control font-semibold">{total}</p>}
          <ul className="flex flex-col items-start gap-1.5">
            {chips.slice(n - hidden).map((chip, i) => (
              <li key={i} className="max-w-full">
                {chip(true)}
              </li>
            ))}
          </ul>
        </Popover>
      )}
      <AddFoodSheet compact={meal.length > 0} />
      {total && (
        <span
          ref={kcal}
          hidden={fit?.kcal === false}
          className="tabular shrink-0 text-control font-semibold whitespace-nowrap max-lg:ml-auto"
        >
          {total}
        </span>
      )}
    </div>
  )
}

/** One food: the chip, and the servings picker it opens (`inline`: under the chip, in the "+n" list). */
function MealChip({ item, inline = false }: { item: MealItem; inline?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const food = lookupFood(item.foodId)
  if (!food) return null
  const name = localized(food.name, lang)
  const steps = [...new Set<number>([...SERVING_STEPS, item.servings])].sort((x, y) => x - y)
  // In the "+n" list (itself a popover) the picker opens under the chip, not as a second popover.
  const Panel = inline ? InlinePanel : Popover
  return (
    <>
      <span ref={anchor} className="inline-flex max-w-full">
        <FoodChip
          emoji={food.emoji}
          name={name}
          servings={item.servings}
          expanded={open}
          onEdit={() => {
            setBlocked(false)
            setOpen((o) => !o)
          }}
          onRemove={() => useRunStore.getState().removeFood(item.foodId)}
        />
      </span>
      {open && (
        <Panel anchor={anchor} onClose={() => setOpen(false)} label={`${t('sim.servings')}: ${name}`} className="w-[17rem]">
          <p className="text-control font-semibold">
            {name} <span className="font-normal text-ink-muted">({localized(food.serving.label, lang)})</span>
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">{t('sim.servings')}</p>
          <div role="group" aria-label={t('sim.servings')} className="mt-2 grid grid-cols-5 gap-1">
            {steps.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === item.servings}
                onClick={() => {
                  if (useRunStore.getState().setServings(item.foodId, n)) setOpen(false)
                  else setBlocked(true)
                }}
                className="tabular min-h-11 rounded-control text-control font-semibold hover:bg-surface-sunk aria-pressed:bg-ink aria-pressed:text-white lg:min-h-9"
              >
                ×{n}
              </button>
            ))}
          </div>
          {blocked && (
            <p role="alert" className="mt-2 text-caption font-semibold">
              {t('sim.capReached', { kcal: PARAMS.maxMealKcal })}
            </p>
          )}
        </Panel>
      )}
    </>
  )
}

/** A servings picker inside the "+n" list: the same contents, in the flow under its chip. */
const InlinePanel = ({ children }: { children: ReactNode }) => <div className="mt-2">{children}</div>

/**
 * "Report a mistake" (D-FEED): the same form as v1. Without an API it opens the pre-filled GitHub
 * issue in a new tab and sends nothing; the report carries this run's link. Not on the projector, like
 * "Copy link" (a teacher reports from their own screen).
 */
function ReportMistake() {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const button = (onClick: () => void) => (
    <IconButton
      icon={<FlagIcon />}
      label={t('sim.reportError')}
      title={t('sim.reportError')}
      aria-haspopup="dialog"
      onClick={onClick}
      // The loaded form's own button replaces this one: it takes the focus back, so closing the form returns there.
      autoFocus={loaded}
    />
  )
  return (
    <span className="in-data-[contrast=high]:hidden">
      {loaded ? (
        // If the form doesn't load, the button stays and says so under it, with "Try again".
        <LoadBoundary
          key={attempt}
          onFail={feedbackDialog.reset}
          fallback={<LoadFailedPanel trigger={button} onRetry={() => setAttempt((a) => a + 1)} attempt={attempt} />}
        >
          <Suspense fallback={button(() => {})}>
            <feedbackDialog.Component context={() => window.location.search.replace(/^\?/, '')} openOnMount trigger={button} />
          </Suspense>
        </LoadBoundary>
      ) : (
        button(() => setLoaded(true))
      )}
    </span>
  )
}
