import { Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PARAMS, SERVING_STEPS, type MealItem } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { LoadBoundary, LoadFailedPanel, lazyWithRetry } from '../LoadBoundary.tsx'
import { FlagIcon, FoodChip, IconButton, LinkIcon, PersonTag } from '../kit/index.ts'
import AddFoodSheet from './AddFoodSheet.tsx'
import KeepButton from './KeepButton.tsx'
import KeptTag, { LineSwatch } from './KeptTag.tsx'
import Popover from './Popover.tsx'
import { mealKcalRounded } from './mealText.ts'

/** The report form is downloaded on the first click: it is not part of the first paint (size budget). */
const feedbackDialog = lazyWithRetry(() => import('../FeedbackDialog.tsx'))

/**
 * The meal bar (UI-13 + UI-3 + UI-10): the meal as flat chips, "+ Add food", its kcal, whose body
 * it is, then the kept run, "Keep to compare", "Copy link" and "Report a mistake". One line from 1024 px up (the chips scroll
 * sideways if they don't fit); on a phone the chips get their own row. The solid and dashed line
 * samples are the key for the graphs: this meal, and the kept one.
 */
export default function MealBar() {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const profile = useRunStore((s) => s.profile)
  const kept = useRunStore((s) => s.kept)

  return (
    <section aria-labelledby="meal-bar-title" className="border-b border-rule2 bg-paper2">
      {/*
       * Phone rows: the meal (chips, add, kcal) / the person and Keep / the kept run, if any. From
       * 1024 px up one line while it fits: the meal counts as 20 rem (its name, a chip, + and kcal;
       * more chips scroll, and a chip's name shortens before its servings or ✕) and grows up to its
       * whole length; the kept run likewise counts as 14 rem, its words wrap before the line does.
       * "Copy link" and "Report a mistake" keep
       * their words only on a bar at least 88 rem wide (rem: Hindi's larger type needs a wider
       * screen). Only when the rest still does not fit (a long translation) does the line wrap,
       * instead of squeezing the chips to nothing or running off the page (WP-18).
       */}
      <div className="@container/bar flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 lg:min-h-14 lg:gap-x-4 lg:px-4">
        <div className="flex min-w-0 basis-full items-center gap-2 lg:max-w-max lg:flex-[1_1_20rem]">
          <h2 id="meal-bar-title" className="flex shrink-0 items-center gap-2 text-control font-semibold text-ink-2 max-lg:sr-only">
            <LineSwatch />
            {t('stage.meal')}
          </h2>
          <ChipStrip>
            {meal.map((item) => (
              <li key={item.foodId} className="max-w-full shrink-0">
                <MealChip item={item} />
              </li>
            ))}
          </ChipStrip>
          <AddFoodSheet compact={meal.length > 0} />
          {meal.length > 0 && (
            <span className="tabular ml-1 shrink-0 text-control font-semibold whitespace-nowrap max-lg:ml-auto">
              {t('units.kcal', { n: mealKcalRounded(meal) })}
            </span>
          )}
        </div>
        <PersonInfo profile={profile} />
        {kept && (
          // On a phone the Now line names the kept meal, with its ✕, right under the meal bar: this
          // row gives way to it while it shows (styles.css), so the body keeps the height (WP-18).
          <div
            data-kept-tag=""
            className="flex min-w-0 max-lg:order-last max-lg:basis-full lg:ml-auto lg:max-w-max lg:flex-[1_1_14rem]"
          >
            <KeptTag />
          </div>
        )}
        {/* From 1024 px up the kept run and Keep sit at the right end. */}
        <div className={`flex shrink-0 items-center gap-1 max-lg:ml-auto ${kept ? '' : 'lg:ml-auto'}`}>
          {/* Their words stay after keeping (council SHOULD 11): from 1280 px up, as before. */}
          <KeepButton />
          <CopyLink />
          <ReportMistake />
        </div>
      </div>
    </section>
  )
}

/**
 * The meal's chips, scrolling sideways when they don't fit. A soft fade at an edge says there is
 * more to scroll to (no scrollbar on most phones).
 */
function ChipStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  const [more, setMore] = useState({ before: false, after: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMore({ before: el.scrollLeft > 1, after: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [children])
  const stops = [more.before ? 'transparent, black 1.5rem' : 'black', more.after ? 'black calc(100% - 1.5rem), transparent' : 'black']
  const mask = more.before || more.after ? `linear-gradient(to right, ${stops.join(', ')})` : undefined
  return (
    // The padding gives focus outlines room inside the scroll box.
    <ul
      ref={ref}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="-m-1 flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none]"
    >
      {children}
    </ul>
  )
}

/** One food: the chip, and the servings picker it opens. */
function MealChip({ item }: { item: MealItem }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const food = lookupFood(item.foodId)
  if (!food) return null
  const name = localized(food.name, lang)
  const steps = [...new Set<number>([...SERVING_STEPS, item.servings])].sort((x, y) => x - y)
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
        <Popover anchor={anchor} onClose={() => setOpen(false)} label={`${t('sim.servings')}: ${name}`} className="w-[17rem]">
          <p className="text-control font-semibold">
            {name} <span className="font-normal text-ink-2">({localized(food.serving.label, lang)})</span>
          </p>
          <p className="mt-0.5 text-caption text-ink-2">{t('sim.servings')}</p>
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
                className="tabular min-h-11 rounded-control text-control font-semibold hover:bg-sunk2 aria-pressed:bg-ink aria-pressed:text-white lg:min-h-9"
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
        </Popover>
      )}
    </>
  )
}

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
          <p className="mt-1 text-control text-ink-2">{t(`profiles.${profile}.desc`)}</p>
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
 * school browsers), the link is shown to copy by hand.
 */
function CopyLink() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const anchor = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const copy = () => {
    const done = navigator.clipboard?.writeText(window.location.href)
    if (!done) return setStatus('manual')
    done.then(
      () => {
        // A second copy while "Link copied" still shows must be said again (review 14-17, LOW 9):
        // empty the status region first, then fill it on the next frame, so it changes.
        setStatus('idle')
        requestAnimationFrame(() => setStatus('copied'))
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus('idle'), 2500)
      },
      () => setStatus('manual'),
    )
  }
  return (
    // Not on phones (plan-ui-ux §3.5) nor on the projector (§3.4). Words on a wide bar (see MealBar).
    <span className="max-lg:hidden in-data-[contrast=high]:hidden">
      <IconButton
        ref={anchor}
        icon={<LinkIcon />}
        label={status === 'copied' ? t('sim.shareCopied') : t('sim.share')}
        title={t('sim.share')}
        onClick={copy}
        className="@max-[88rem]/bar:w-9 @max-[88rem]/bar:justify-center @max-[88rem]/bar:px-0 @max-[88rem]/bar:[&>span]:sr-only"
      />
      {/* Said once by screen readers when the link is copied (verify-1 A5): a status region of its own. */}
      <span role="status" className="sr-only">
        {status === 'copied' ? t('sim.shareCopied') : ''}
      </span>
      {status === 'manual' && (
        <Popover anchor={anchor} onClose={() => setStatus('idle')} label={t('sim.shareManual')} className="w-[22rem]">
          <label className="block text-caption text-ink-2">
            {t('sim.shareManual')}
            <input
              readOnly
              value={window.location.href}
              onFocus={(e) => e.target.select()}
              className="mt-1 block w-full rounded-control bg-sunk2 px-2 py-1.5 text-control text-ink"
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
 * (see MealBar); the flag alone on a phone. Not on the projector, like
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
      className="@max-[88rem]/bar:w-11 @max-[88rem]/bar:justify-center @max-[88rem]/bar:px-0 lg:@max-[88rem]/bar:w-9 @max-[88rem]/bar:[&>span]:sr-only"
    />
  )
  return (
    <span className="in-data-[contrast=high]:hidden">
      {loaded ? (
        // If the form doesn't load, the button stays and says so under it, with "Try again".
        <LoadBoundary
          key={attempt}
          onFail={feedbackDialog.reset}
          fallback={<LoadFailedPanel trigger={button} onRetry={() => setAttempt((a) => a + 1)} />}
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
