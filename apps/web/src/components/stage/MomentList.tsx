import { useTranslation } from 'react-i18next'
import { useClock } from '../../state/clock.ts'
import { useSheet } from '../../state/sheet.ts'
import Sheet from './Sheet.tsx'

/**
 * The key moments one timeline target holds (FP-3, U7): moments of either meal that nearly
 * coincide share a finger-wide target, and pressing it lists them here, each "name, time" as a
 * button that pauses and moves the clock there. Downloaded with the other sheets (Sheets.tsx).
 */
export default function MomentList({ moments }: { moments: [line: string, atMin: number][] }) {
  const { t } = useTranslation()
  return (
    <Sheet title={t('dock.moments')}>
      <ul className="-mx-2 flex flex-col">
        {moments.map(([line, atMin]) => (
          <li key={line}>
            <button
              type="button"
              onClick={() => {
                const clock = useClock.getState()
                clock.pause()
                clock.setSimMin(atMin)
                useSheet.getState().close()
              }}
              className="flex min-h-11 w-full items-center rounded-control px-2 text-left font-semibold hover:bg-surface-sunk lg:min-h-9"
            >
              {line}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
