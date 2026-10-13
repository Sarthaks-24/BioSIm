import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useBackCloses } from '../../lib/backCloses.ts'
import { useSheet } from '../../state/sheet.ts'
import { CloseIcon } from '../kit/index.ts'

/**
 * The frame of the stage's sheets (the graphs as a table, keys and settings): a native modal
 * <dialog>, so focus stays inside, the page behind is inert for screen readers, and Esc closes
 * it. A bottom sheet on a phone (thumbs reach it), a centred panel from 1024 px up. Closing (Esc,
 * ✕, a press outside, Back: lib/backCloses.ts) puts focus back where it was (state/sheet.ts).
 */
export default function Sheet({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const titleId = useId()
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])
  useBackCloses(() => dialog.current?.close())
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={() => useSheet.getState().close()}
      // A press on the backdrop (the dialog element itself, outside its box) closes it; a drag
      // that starts inside (selecting text) and ends outside does not (review 15).
      onPointerDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => pressedOutside.current && e.target === e.currentTarget && dialog.current?.close()}
      className={`flex-col overflow-hidden border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30 open:flex max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:m-0 max-lg:max-h-[85dvh] max-lg:w-full max-lg:max-w-none max-lg:rounded-t-frame max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] lg:m-auto lg:max-h-[min(44rem,calc(100dvh-3rem))] lg:rounded-frame lg:border ${wide ? 'lg:w-[44rem]' : 'lg:w-[32rem]'}`}
    >
      <div className="flex items-center gap-2 border-b border-border py-1.5 pr-1.5 pl-4">
        <h2 id={titleId} className="flex-1 text-title font-extrabold">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label={t('stage.close')}
          title={t('stage.close')}
          className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:size-9"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 text-control">{children}</div>
    </dialog>
  )
}
