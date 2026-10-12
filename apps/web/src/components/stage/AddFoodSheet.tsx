import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ITEMS, PARAMS } from '@lifepeek/engine'
import { FOODS } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { CheckIcon, CloseIcon, IconButton, PlusIcon, SearchIcon } from '../kit/index.ts'

/**
 * "+ Add food" and its food search (UI-13). One list of every food with a search box on top. On a
 * phone it is a bottom sheet (thumbs reach it); from 1024 px up it opens under the button. A
 * native modal <dialog>: focus stays inside, Esc closes it, focus goes back to the button.
 * Choosing a food adds it and closes; if the meal would go over the cap, the sheet stays open and
 * says why.
 */
export default function AddFoodSheet({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const meal = useRunStore((s) => s.meal)
  const capBlocked = useRunStore((s) => s.capBlocked)
  const full = meal.length >= MAX_ITEMS
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const id = useId()
  const listId = `${id}-list`
  const titleId = `${id}-title`

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FOODS.filter((f) => !q || Object.values(f.name).some((n) => n?.toLowerCase().includes(q)) || f.id.includes(q))
  }, [query])
  const inMeal = (foodId: string) => meal.some((i) => i.foodId === foodId)

  const show = () => {
    const r = opener.current?.getBoundingClientRect()
    setAnchor(r ? { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - 24 * 16)) } : null)
    setQuery('')
    setActive(0)
    useRunStore.setState({ capBlocked: false })
    setOpen(true)
  }
  const close = () => dialog.current?.close()

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      input.current?.focus()
    }
  }, [open])

  const choose = (foodId: string) => {
    if (inMeal(foodId)) return
    if (useRunStore.getState().addFood(foodId)) close()
  }

  const activeOption = options[active]
  return (
    <>
      <IconButton
        ref={opener}
        icon={<PlusIcon />}
        label={t('sim.addFood')}
        onClick={show}
        disabled={full}
        aria-haspopup="dialog"
        title={full ? t('stage.mealFull', { n: MAX_ITEMS }) : undefined}
        // Next to food chips "+" alone is clear (the words stay its name); with no food yet the
        // words show, as the first thing to do.
        className={`bg-sunk2/60 ${compact ? 'w-11 justify-center px-0 lg:w-9 [&>span]:sr-only' : ''}`}
      />
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // A press on the backdrop (the dialog element itself, outside its box) closes it.
        onClick={(e) => e.target === e.currentTarget && close()}
        style={anchor ? { top: anchor.top, left: anchor.left } : undefined}
        className="m-0 flex-col overflow-hidden border-rule2 bg-shelf p-0 text-ink backdrop:bg-ink/25 open:flex max-lg:inset-x-0 max-lg:top-auto! max-lg:bottom-0 max-lg:left-0! max-lg:max-h-[80dvh] max-lg:w-full max-lg:max-w-none max-lg:rounded-t-frame max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] lg:max-h-[min(32rem,calc(100dvh-2rem))] lg:w-[24rem] lg:rounded-control lg:border lg:backdrop:bg-transparent"
      >
        <div className="flex items-center gap-2 border-b border-rule2 py-1 pr-1 pl-4">
          <h2 id={titleId} className="flex-1 text-control font-semibold">
            {t('sim.addFood')}
          </h2>
          <IconButton icon={<CloseIcon />} label={t('stage.close')} iconOnly onClick={close} />
        </div>
        <div className="px-3 pt-3 pb-2">
          <label className="flex min-h-11 items-center gap-2 rounded-control bg-sunk2 px-3 text-ink-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink lg:min-h-10">
            <SearchIcon />
            <span className="sr-only">{t('stage.search')}</span>
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeOption ? `${id}-opt-${activeOption.id}` : undefined}
              placeholder={t('stage.search')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(options.length - 1, a + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(0, a - 1))
                } else if (e.key === 'Enter' && activeOption) {
                  e.preventDefault()
                  choose(activeOption.id)
                }
              }}
              // The search box (the label) shows the focus ring, so the field doesn't draw a second one.
              style={{ outline: 'none' }}
              className="min-w-0 flex-1 bg-transparent text-control text-ink placeholder:text-ink-2"
            />
          </label>
          {capBlocked && (
            <p role="alert" className="mt-2 text-caption font-semibold text-ink">
              {t('sim.capReached', { kcal: PARAMS.maxMealKcal })}
            </p>
          )}
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label={t('sim.addFood')}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2"
        >
          {options.map((f, idx) => {
            const added = inMeal(f.id)
            return (
              <li
                key={f.id}
                id={`${id}-opt-${f.id}`}
                role="option"
                aria-selected={idx === active}
                aria-disabled={added || undefined}
                onPointerEnter={() => setActive(idx)}
                onClick={() => choose(f.id)}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-control lg:min-h-10 ${
                  idx === active ? 'bg-sunk2' : ''
                } ${added ? 'cursor-default text-ink-2' : ''}`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {f.emoji}
                </span>
                <span className="flex-1 py-1 font-semibold">{localized(f.name, lang)}</span>
                <span className="flex max-w-[45%] items-center gap-1 py-1 text-right text-caption text-ink-2">
                  {added ? (
                    <>
                      <CheckIcon />
                      {t('stage.inMeal')}
                    </>
                  ) : (
                    localized(f.serving.label, lang)
                  )}
                </span>
              </li>
            )
          })}
          {options.length === 0 && <li className="px-2.5 py-3 text-control text-ink-2">{t('stage.noMatch', { query: query.trim() })}</li>}
        </ul>
      </dialog>
    </>
  )
}
