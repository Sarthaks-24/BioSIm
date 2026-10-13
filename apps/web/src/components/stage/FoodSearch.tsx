import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PARAMS } from '@lifepeek/engine'
import { FOODS } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { useRunStore } from '../../state/run.ts'
import { CheckIcon, CloseIcon, IconButton, SearchIcon } from '../kit/index.ts'

/**
 * The food search of "+ Add food" (UI-13): one list of every food with a search box on top. On a
 * phone it is a bottom sheet (thumbs reach it); from 1024 px up it opens under the button. A
 * native modal <dialog>: focus stays inside, Esc closes it, focus goes back to the button.
 * Choosing a food adds it and closes; if the meal would go over the cap, the sheet stays open and
 * says why. Downloaded the first time "+ Add food" is pressed (AddFoodSheet, size budget).
 */
export default function FoodSearch({ anchor, onClose }: { anchor: { top: number; left: number } | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const meal = useRunStore((s) => s.meal)
  const capBlocked = useRunStore((s) => s.capBlocked)
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const id = useId()
  const listId = `${id}-list`
  const titleId = `${id}-title`

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FOODS.filter((f) => !q || Object.values(f.name).some((n) => n?.toLowerCase().includes(q)) || f.id.includes(q))
  }, [query])
  const inMeal = (foodId: string) => meal.some((i) => i.foodId === foodId)
  const close = () => dialog.current?.close()

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) {
      d.showModal()
      input.current?.focus()
    }
  }, [])

  const choose = (foodId: string) => {
    if (inMeal(foodId)) return
    if (useRunStore.getState().addFood(foodId)) close()
  }

  const activeOption = options[active]
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A press on the backdrop (the dialog element itself, outside its box) closes it; a drag
      // that starts inside (selecting text) and ends outside does not (review 15).
      onPointerDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => pressedOutside.current && e.target === e.currentTarget && close()}
      style={anchor ? { top: anchor.top, left: anchor.left } : undefined}
      className="m-0 flex-col overflow-hidden border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/25 open:flex max-lg:inset-x-0 max-lg:top-auto! max-lg:bottom-0 max-lg:left-0! max-lg:max-h-[80dvh] max-lg:w-full max-lg:max-w-none max-lg:rounded-t-frame max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] lg:max-h-[min(32rem,calc(100dvh-2rem))] lg:w-[24rem] lg:rounded-control lg:border lg:backdrop:bg-transparent"
    >
      <div className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-4">
        <h2 id={titleId} className="flex-1 text-control font-semibold">
          {t('sim.addFood')}
        </h2>
        <IconButton icon={<CloseIcon />} label={t('stage.close')} iconOnly onClick={close} />
      </div>
      <div className="px-3 pt-3 pb-2">
        <label className="flex min-h-11 items-center gap-2 rounded-control bg-surface-sunk px-3 text-ink-muted focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink lg:min-h-10">
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
            className="min-w-0 flex-1 bg-transparent text-control text-ink placeholder:text-ink-muted"
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
                idx === active ? 'bg-surface-sunk' : ''
              } ${added ? 'cursor-default text-ink-muted' : ''}`}
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {f.emoji}
              </span>
              <span className="flex-1 py-1 font-semibold">{localized(f.name, lang)}</span>
              <span className="flex max-w-[45%] items-center gap-1 py-1 text-right text-caption text-ink-muted">
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
        {options.length === 0 && <li className="px-2.5 py-3 text-control text-ink-muted">{t('stage.noMatch', { query: query.trim() })}</li>}
      </ul>
    </dialog>
  )
}
