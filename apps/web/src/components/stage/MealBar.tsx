import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PARAMS, SERVING_STEPS, type MealItem } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { FoodChip, IconButton, LinkIcon, PersonTag } from '../kit/index.ts'
import AddFoodSheet from './AddFoodSheet.tsx'
import KeepButton from './KeepButton.tsx'
import KeptTag, { LineSwatch } from './KeptTag.tsx'
import Popover from './Popover.tsx'
import { mealKcalRounded } from './mealText.ts'

/**
 * The meal bar (UI-13 + UI-3 + UI-10): the meal as flat chips, "+ Add food", its kcal, whose body
 * it is, then the kept run and "Keep to compare". One line from 1024 px up (the chips scroll
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
      {/* Phone rows: the meal (chips, add, kcal) / the person and Keep / the kept run, if any. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 lg:min-h-14 lg:flex-nowrap lg:gap-x-4 lg:px-4">
        <div className="flex min-w-0 basis-full items-center gap-2 lg:basis-auto">
          <h2 id="meal-bar-title" className="flex shrink-0 items-center gap-2 text-control font-semibold text-ink-2 max-lg:sr-only">
            <LineSwatch />
            {t('stage.meal')}
          </h2>
          <ChipStrip>
            {meal.map((item) => (
              <li key={item.foodId} className="shrink-0">
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
        {/* Takes the free space from 1024 px up, so the kept run and Keep sit at the right end. */}
        <span aria-hidden="true" className="hidden flex-1 lg:block" />
        {kept && (
          <div className="flex min-w-0 shrink-0 max-lg:order-last max-lg:basis-full">
            <KeptTag />
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 max-lg:ml-auto">
          <KeepButton compact={!!kept} />
          <CopyLink compact={!!kept} />
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
      <span ref={anchor} className="inline-flex">
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

/** "Adult model ⓘ": the ⓘ opens who the model is, with a link to the sources. */
function PersonInfo({ profile }: { profile: Parameters<typeof PersonTag>[0]['profile'] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  return (
    <>
      <span ref={anchor} className="inline-flex shrink-0">
        <PersonTag profile={profile} onInfo={() => setOpen((o) => !o)} />
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
function CopyLink({ compact }: { compact: boolean }) {
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
        setStatus('copied')
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus('idle'), 2500)
      },
      () => setStatus('manual'),
    )
  }
  return (
    // Not on phones (plan-ui-ux §3.5) nor on the projector (§3.4). Words from 1280 px up, unless the
    // kept tag needs the room.
    <span className="max-lg:hidden in-data-[contrast=high]:hidden">
      <IconButton
        ref={anchor}
        icon={<LinkIcon />}
        label={status === 'copied' ? t('sim.shareCopied') : t('sim.share')}
        title={t('sim.share')}
        aria-live="polite"
        onClick={copy}
        className={
          compact ? 'w-9 justify-center px-0 [&>span]:sr-only' : 'max-xl:w-9 max-xl:justify-center max-xl:px-0 [&>span]:max-xl:sr-only'
        }
      />
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
