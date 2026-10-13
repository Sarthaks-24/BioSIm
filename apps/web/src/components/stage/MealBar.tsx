import { Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PARAMS, SERVING_STEPS, type MealItem } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { LoadBoundary, LoadFailedPanel, lazyWithRetry } from '../LoadBoundary.tsx'
import { FlagIcon, FoodChip, IconButton, LinkIcon, MoreIcon, PersonTag } from '../kit/index.ts'
import AddFoodSheet from './AddFoodSheet.tsx'
import KeepButton from './KeepButton.tsx'
import KeptTag, { LineSwatch } from './KeptTag.tsx'
import Popover from './Popover.tsx'
import { mealKcalRounded } from './mealText.ts'

/** The report form is downloaded on the first click: it is not part of the first paint (size budget). */
const feedbackDialog = lazyWithRetry(() => import('../FeedbackDialog.tsx'))

/**
 * The e2e build's stand-in for v3's activity bouts (`&fixture=bouts`, only where VITE_PSEUDO=1):
 * the three longest bout chips, so the one-row rule is tested with them before they exist (FP-1,
 * B15). The flag is written out, so a real build drops this.
 */
const fixtureBouts = (): string[] =>
  import.meta.env.VITE_PSEUDO === '1' && location.search.includes('fixture=bouts')
    ? ['Brisk walking 120 min, from 11:30', 'Skipping rope 105 min, from 10:45', 'Playing football 90 min, from 12:00']
    : []

/**
 * The meal bar (UI-13 + UI-3 + UI-10; FP-1's plan strip): the meal as flat chips, "+ Add food" and
 * its kcal, then whose body it is, the kept run, "Keep to compare", "Copy link" and "Report a
 * mistake". The chips are one line at every width (bug B2): those that don't fit fold into a "+n"
 * chip (PlanStrip). From 1024 px up the rest sits on the same line, the kept run counting as
 * 14 rem (its words wrap before the line does); "Copy link" and "Report a mistake" keep their words
 * only on a bar at least 88 rem wide (rem: Hindi's larger type needs a wider screen), and only a
 * long translation still wraps the line. On a phone the rest is behind "⋯": a row of its own
 * while open, with the words. The solid and dashed line samples are the key for the graphs: this
 * meal, and the kept one.
 */
export default function MealBar() {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const profile = useRunStore((s) => s.profile)
  const kept = useRunStore((s) => s.kept)
  const [bouts] = useState(fixtureBouts)
  const [more, setMore] = useState(false)
  const moreId = useId()

  return (
    <section aria-labelledby="meal-bar-title" className="border-b border-border bg-surface-page">
      <div className="@container/bar flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 lg:min-h-14 lg:gap-x-4 lg:px-4">
        <PlanStrip meal={meal} bouts={bouts} />
        {kept && (
          // On a phone the Now line names the kept meal, with its ✕, right under the meal bar: this
          // row gives way to it while it shows (styles.css), so the body keeps the height (WP-18).
          <div
            data-kept-tag=""
            className="flex min-w-0 max-lg:order-last max-lg:basis-full lg:order-1 lg:ml-auto lg:max-w-max lg:flex-[1_1_14rem]"
          >
            <KeptTag />
          </div>
        )}
        <IconButton
          icon={<MoreIcon />}
          label={t('stage.actions')}
          iconOnly
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore(!more)}
          className="lg:hidden"
        />
        {/* A phone's "⋯" row; from 1024 px up its parts are on the bar's line (`contents`). */}
        <div id={moreId} className={`${more ? 'flex' : 'max-lg:hidden'} basis-full flex-wrap items-center justify-end gap-1 lg:contents`}>
          <PersonInfo profile={profile} />
          {/* From 1024 px up the kept run and Keep sit at the right end. */}
          <div className={`flex shrink-0 items-center gap-1 lg:order-2 ${kept ? '' : 'lg:ml-auto'}`}>
            {/* Their words stay after keeping (council SHOULD 11). */}
            <KeepButton />
            <CopyLink />
            <ReportMistake />
          </div>
        </div>
      </div>
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
function PlanStrip({ meal, bouts }: { meal: readonly MealItem[]; bouts: readonly string[] }) {
  const { t, i18n } = useTranslation()
  const strip = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const kcal = useRef<HTMLSpanElement>(null)
  // How many chips show, and whether the kcal does; null while everything is laid out to be measured.
  const [fit, setFit] = useState<{ shown: number; kcal: boolean } | null>(null)
  const chips = [
    ...meal.map((item) => (inline?: boolean) => <MealChip item={item} inline={inline} />),
    ...bouts.map((text) => () => <FoodChip kind="bout" emoji="🚶" name={text} onRemove={() => {}} />),
  ]
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
  // Again when the strip's width changes, and once the web font is in (it makes chips wider).
  useEffect(() => {
    let width = 0
    const ro = new ResizeObserver(() => {
      if (strip.current && strip.current.clientWidth !== width) {
        width = strip.current.clientWidth
        setFit(null)
      }
    })
    ro.observe(strip.current!)
    document.fonts?.ready.then(() => setFit(null))
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={strip} className="flex min-w-0 flex-1 items-center gap-1.5 lg:flex-[1_1_20rem] lg:gap-2">
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

/** "Typical adult ⓘ": the ⓘ opens who the model is, with a link to the sources. */
function PersonInfo({ profile }: { profile: Parameters<typeof PersonTag>[0]['profile'] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  return (
    <>
      <span ref={anchor} className="inline-flex shrink-0">
        <PersonTag profile={profile} onInfo={() => setOpen((o) => !o)} expanded={open} />
      </span>
      {open && (
        <Popover anchor={anchor} onClose={() => setOpen(false)} label={t(`profiles.${profile}.tag`)} className="w-[20rem]">
          <p className="text-control font-semibold">{t(`profiles.${profile}.tag`)}</p>
          <p className="mt-1 text-control text-ink-muted">{t(`profiles.${profile}.desc`)}</p>
          <Link to="/science" className="mt-2 inline-block text-control font-semibold underline underline-offset-2">
            {t('nav.science')}
          </Link>
        </Popover>
      )}
    </>
  )
}

/**
 * Copy the address: the link sync keeps it equal to this exact run. If copying is blocked (some
 * school browsers), the link is shown to copy by hand. On a touch screen with a share sheet it
 * opens the sheet instead, as v1's share button did.
 */
function CopyLink() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const anchor = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const refill = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(refill.current)
    },
    [],
  )

  const copy = () => {
    // A touch screen with a share sheet (a tablet) shares the link with the summary sentence, in
    // the language on screen, so the message says what the link shows (council round 3). Read
    // from the sentence itself (SummaryLine): it is the stage's answer, already worded.
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      const text = document.querySelector('[data-summary-headline]')?.textContent ?? undefined
      navigator.share({ title: 'LifePeek', text, url: window.location.href }).catch(() => undefined)
      return
    }
    const done = navigator.clipboard?.writeText(window.location.href)
    if (!done) return setStatus('manual')
    done.then(
      () => {
        // A second copy while "Link copied" still shows must be said again (review 14-17, LOW 9):
        // empty the status region first, then fill it 80 ms later (one frame apart, some screen
        // readers merge the two changes and say nothing: FIX-C review, item 7).
        setStatus('idle')
        clearTimeout(refill.current)
        clearTimeout(timer.current)
        refill.current = setTimeout(() => {
          setStatus('copied')
          timer.current = setTimeout(() => setStatus('idle'), 2500)
        }, 80)
      },
      () => setStatus('manual'),
    )
  }
  return (
    // Not on the projector (§3.4). Words in a phone's "⋯" row and on a wide bar (see MealBar).
    <span className="in-data-[contrast=high]:hidden">
      <IconButton
        ref={anchor}
        icon={<LinkIcon />}
        label={status === 'copied' ? t('sim.shareCopied') : t('sim.share')}
        title={t('sim.share')}
        onClick={copy}
        className="lg:@max-[88rem]/bar:w-9 lg:@max-[88rem]/bar:justify-center lg:@max-[88rem]/bar:px-0 lg:@max-[88rem]/bar:[&>span]:sr-only"
      />
      {/* Said once by screen readers when the link is copied (verify-1 A5): a status region of its own. */}
      <span role="status" className="sr-only">
        {status === 'copied' ? t('sim.shareCopied') : ''}
      </span>
      {status === 'manual' && (
        <Popover anchor={anchor} onClose={() => setStatus('idle')} label={t('sim.shareManual')} className="w-[22rem]">
          <label className="block text-caption text-ink-muted">
            {t('sim.shareManual')}
            <input
              readOnly
              value={window.location.href}
              onFocus={(e) => e.target.select()}
              className="mt-1 block w-full rounded-control bg-surface-sunk px-2 py-1.5 text-control text-ink"
            />
          </label>
        </Popover>
      )}
    </span>
  )
}

/**
 * "Report a mistake" (D-FEED): the same form as v1. Without an API it opens the pre-filled GitHub
 * issue in a new tab and sends nothing; the report carries this run's link. Words on a wide bar
 * and in a phone's "⋯" row (see MealBar). Not on the projector, like
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
      className="lg:@max-[88rem]/bar:w-9 lg:@max-[88rem]/bar:justify-center lg:@max-[88rem]/bar:px-0 lg:@max-[88rem]/bar:[&>span]:sr-only"
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
