import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ITEMS, MAX_SERVINGS } from '@biosim/engine'
import { FOODS, lookupFood } from '../data/foods.ts'
import { localized } from '../i18n/index.ts'
import { useSim, type MealKey } from '../state/sim.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

export default function MealPicker({ meal }: { meal: MealKey }) {
  const { t, i18n } = useTranslation()
  const items = useSim((s) => s[meal])
  const { addFood, setServings, removeFood } = useSim.getState()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const lang = i18n.language
  const title = meal === 'a' ? t('sim.mealA') : t('sim.mealB')

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FOODS.filter((f) => !items.some((i) => i.foodId === f.id)).filter(
      (f) => !q || f.name.en.toLowerCase().includes(q) || (f.name.hi ?? '').includes(q) || f.id.includes(q),
    )
  }, [query, items])

  const kcal = items.reduce((sum, i) => sum + (lookupFood(i.foodId)?.nutrients.energyKcal ?? 0) * i.servings, 0)

  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
          style={{ background: MEAL_COLOR[meal] }}
          aria-hidden="true"
        >
          {meal.toUpperCase()}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        {items.length > 0 && <span className="tabular ml-auto text-sm text-ink-2">{t('sim.kcal', { value: Math.round(kcal) })}</span>}
      </div>

      {items.length === 0 && <p className="mb-2 text-sm text-ink-2">{meal === 'b' ? t('sim.pickBoth') : t('sim.emptyMeal')}</p>}

      <ul className="mb-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const food = lookupFood(item.foodId)
          if (!food) return null
          const name = localized(food.name, lang)
          return (
            <li key={item.foodId} className="flex items-center gap-1 rounded-full border border-rule bg-panel py-1 pr-1 pl-3 text-sm">
              <span aria-hidden="true">{food.emoji}</span>
              <span className="font-semibold">{name}</span>
              <label className="sr-only" htmlFor={`${listId}-${item.foodId}`}>
                {t('sim.servings')} — {name}
              </label>
              <select
                id={`${listId}-${item.foodId}`}
                value={item.servings}
                onChange={(e) => setServings(meal, item.foodId, Number(e.target.value))}
                className="tabular rounded-full bg-sunk px-1.5 py-0.5 text-sm"
                title={localized(food.serving.label, lang)}
              >
                {[0.5, 1, 1.5, 2, 3, 4, MAX_SERVINGS].map((n) => (
                  <option key={n} value={n}>
                    ×{n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeFood(meal, item.foodId)}
                className="grid size-6 place-items-center rounded-full text-ink-2 hover:bg-sunk hover:text-ink"
                aria-label={t('sim.remove', { name })}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      {items.length < MAX_ITEMS && (
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-opt-${options[active].id}` : undefined}
            placeholder={`+ ${t('sim.addFood')}`}
            aria-label={`${t('sim.addFood')} — ${title}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
                setActive((a) => Math.min(options.length - 1, a + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              }
              if (e.key === 'Enter' && open && options[active]) {
                e.preventDefault()
                addFood(meal, options[active].id)
                setQuery('')
                setActive(0)
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            className="w-full rounded-lg border border-rule bg-panel px-3 py-2 text-sm placeholder:text-ink-2"
          />
          {open && options.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-rule bg-panel py-1 shadow-lg"
            >
              {options.map((f, idx) => (
                <li
                  key={f.id}
                  id={`${listId}-opt-${f.id}`}
                  role="option"
                  aria-selected={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addFood(meal, f.id)
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${idx === active ? 'bg-sunk' : ''}`}
                >
                  <span aria-hidden="true">{f.emoji}</span>
                  <span className="font-semibold">{localized(f.name, lang)}</span>
                  <span className="ml-auto text-xs text-ink-2">{localized(f.serving.label, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
