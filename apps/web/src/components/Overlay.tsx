import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useBackCloses } from '../lib/backCloses.ts'
import { CloseIcon } from './kit/index.ts'

export interface OverlayProps {
  /** The button that opened it (or a box around it): a popover sits by it, and focus goes back to it on close. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  /** Its title, shown in its top row beside "Close", and its name for screen readers. */
  label: string
  children: ReactNode
  /** The popover's width from 1024 px up (a sheet is the window's width), e.g. `w-[20rem]`. */
  width?: string
  /** Classes of the part under the title (the part that scrolls). */
  className?: string
  /** A menu: every button or link in it closes it, focus back on its button (FP-5, B10). A control marked `data-stay` doesn't. */
  menu?: boolean
  /**
   * Not in the way of the stage ("More" on a phone): no dimmed page, and a press or focus elsewhere
   * leaves it open, so Play can be pressed while it is read.
   */
  modeless?: boolean
  /** A sheet's top stays below this box (the body "More" explains), as long as that leaves it 40 % of the window. */
  clear?: RefObject<HTMLElement | null>
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'
/** From 1024 px up a popover by its button; below, a sheet from the bottom of the window. */
const WIDE = '(min-width: 64rem)'
/** Room kept between an overlay and the window's edges, the header and its button (px). */
const GAP = 8

/** The control focus goes back to: the anchor itself, or the first control inside it (a chip's edit button). */
function triggerOf(anchor: HTMLElement | null): HTMLElement | null {
  if (!anchor) return null
  return anchor.matches(FOCUSABLE) ? anchor : anchor.querySelector<HTMLElement>(FOCUSABLE)
}

/** Where the header ends: no overlay goes above it (B5: "How we know" opened flush with the top, over the header). */
const headerBottom = () => document.querySelector('header')?.getBoundingClientRect().bottom ?? 0

/**
 * The stage's small panels (FP-5): "How we know", "⋯", a food's servings, the "+n" list, and on a
 * phone "More". One component, downloaded the first time one opens (stage/Popover.tsx; size budget).
 *
 * - From 1024 px up a popover by its button: under it if it fits, else above it, else on the side
 *   with more room, never above the header's bottom edge and never past the window's edges. A
 *   panel taller than its room scrolls, its last line fading out while there is more.
 * - Below 1024 px a sheet from the bottom of the window, over a dimmed page that leaves the header
 *   clear; a press on the dimmed page closes it. "More" (`modeless`, `clear`) dims nothing and
 *   stays under the body it explains.
 * - Its top row is its title and a "Close" button (B5: the phone's "How we know" had none).
 * - Esc, Back (lib/backCloses.ts), "Close", a press outside, or focus going elsewhere close it.
 *   Closing from the keyboard (and from a menu's item) puts focus back on its button: the panel
 *   lives at the end of <body>, so without that, Tab would leave the page.
 *
 * Keyboard and screen readers: the panel itself takes focus once it is placed, so its name and
 * text are read from the top (not from its first link, which may be at the bottom). Tab moves
 * through its controls; tabbing past the first or last one closes it.
 *
 * Its classes are ones the first paint already has; what only it needs is in inline styles, so
 * it adds nothing to the page's CSS (size budget).
 */
export default function Overlay({
  anchor,
  onClose,
  label,
  children,
  width = '',
  className = '',
  menu = false,
  modeless = false,
  clear,
}: OverlayProps) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches)
  const [place, setPlace] = useState<CSSProperties | null>(null)
  const [fade, setFade] = useState(false)
  const close = useRef(onClose)
  close.current = onClose
  const closed = useRef(false)
  const done = (refocus: boolean) => {
    if (closed.current) return
    closed.current = true
    const trigger = triggerOf(anchor.current)
    close.current()
    if (refocus) trigger?.focus()
  }
  const doneRef = useRef(done)
  doneRef.current = done
  useBackCloses(() => done(true))

  /** Fits the panel to the window (and on a wide screen by its button), then says whether it scrolls. */
  const fit = useRef(() => {})
  fit.current = () => {
    const p = panel.current
    const b = body.current
    if (!p || !b) return
    const isWide = matchMedia(WIDE).matches
    const top0 = headerBottom() + GAP
    const vh = window.innerHeight
    // Its height with nothing cut: the title row plus all of the text.
    const natural = p.offsetHeight - b.clientHeight + b.scrollHeight
    let next: CSSProperties
    if (!isWide) {
      const below = clear?.current ? Math.min(clear.current.getBoundingClientRect().bottom, 0.6 * vh) : 0
      next = { top: 'auto', bottom: 0, left: 0, right: 0, maxHeight: vh - Math.max(top0, below) }
    } else {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      const below = vh - GAP - (a.bottom + 6)
      const above = a.top - 6 - top0
      const down = natural <= below || below >= above
      const height = Math.min(natural, Math.max(down ? below : above, 0))
      const vw = document.documentElement.clientWidth
      next = {
        top: Math.max(top0, down ? a.bottom + 6 : a.top - 6 - height),
        left: Math.max(GAP, Math.min(a.left, vw - p.offsetWidth - GAP)),
        maxHeight: height,
      }
    }
    setWide(isWide)
    setPlace(next)
    if (scrim.current) scrim.current.style.top = `${top0 - GAP}px`
  }
  const sayFade = () => {
    const b = body.current
    if (b) setFade(b.scrollTop + b.clientHeight < b.scrollHeight - 1)
  }

  useLayoutEffect(() => {
    fit.current()
    // Again when what it holds changes size (the "⋯" actions arrive after it opens).
    const ro = new ResizeObserver(() => fit.current())
    ro.observe(content.current!)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(sayFade, [place])
  const placed = place !== null
  // Focus the panel once it is visible (a hidden element can't take focus).
  useEffect(() => {
    if (placed) panel.current?.focus({ preventScroll: true })
  }, [placed])

  useEffect(() => {
    const anchorEl = anchor.current
    const panelEl = panel.current!
    const finish = (refocus: boolean) => doneRef.current(refocus)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      finish(true)
    }
    // Tab past the last control (or Shift+Tab before the first) leaves the panel: back to the button.
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const controls = [...panelEl.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const at = document.activeElement
      const leaving = e.shiftKey ? at === panelEl || at === controls[0] : controls.length === 0 || at === controls.at(-1)
      if (leaving) {
        e.preventDefault()
        finish(true)
      }
    }
    // Focus moved elsewhere (a click, a screen reader's own cursor): close. Back to the button only
    // if focus left the page; a click on the button itself toggles it as usual.
    const onFocusOut = (e: FocusEvent) => {
      if (modeless) return
      const to = e.relatedTarget as Node | null
      if (to && (panelEl.contains(to) || anchorEl?.contains(to))) return
      // Not when the panel (or the control in it) is being taken away, nor when the whole window
      // lost focus (switching apps): only focus moving elsewhere in the page.
      queueMicrotask(() => {
        if (panelEl.isConnected && document.hasFocus() && !panelEl.contains(document.activeElement)) finish(to === null)
      })
    }
    // A press outside closes it. Not the dimmed page under a sheet: its own click closes it, so the
    // tap ends there instead of pressing what was under it.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (modeless || panelEl.contains(target) || anchorEl?.contains(target) || target === scrim.current) return
      finish(false)
    }
    // A popover moves away from its button when the page scrolls: it closes. Scrolling inside it
    // (a long "How we know") keeps it open; a sheet keeps its place.
    const onScroll = (e: Event) => {
      if (matchMedia(WIDE).matches && !panelEl.contains(e.target as Node)) finish(false)
    }
    // A menu: any of its buttons or links did what it does, so it closes (FP-5).
    const onClick = (e: MouseEvent) => {
      const control = (e.target as Element).closest('button, a')
      if (menu && control && panelEl.contains(control) && !control.closest('[data-stay]')) finish(true)
    }
    const onResize = () => fit.current()
    window.addEventListener('keydown', onKey)
    panelEl.addEventListener('keydown', onTab)
    panelEl.addEventListener('focusout', onFocusOut)
    panelEl.addEventListener('click', onClick)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      panelEl.removeEventListener('keydown', onTab)
      panelEl.removeEventListener('focusout', onFocusOut)
      panelEl.removeEventListener('click', onClick)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, menu, modeless])

  const fadeOut = 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)'
  // In <body>, so a parent with CSS containment (the graph column) can never clip or move it.
  return createPortal(
    <>
      {!wide && !modeless && (
        <div
          ref={scrim}
          aria-hidden="true"
          onClick={() => done(true)}
          className="fixed inset-x-0 bottom-0 z-40 bg-ink/30"
          style={{ top: headerBottom() }}
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-overlay={wide ? 'popover' : 'sheet'}
        style={{
          ...(place ?? { top: 0, left: 0, visibility: 'hidden' }),
          ...(wide ? {} : { borderRadius: 'var(--radius-frame) var(--radius-frame) 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }),
        }}
        className={`fixed z-40 flex flex-col overflow-hidden border-border bg-surface-raised text-ink focus:outline-none ${
          wide ? `max-w-[calc(100vw-1rem)] rounded-control border ${width}` : 'border-t'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border py-1.5 pr-1.5 pl-4">
          <h2 id={titleId} className="min-w-0 flex-1 text-control font-semibold">
            {label}
          </h2>
          <button
            type="button"
            data-stay=""
            onClick={() => done(true)}
            aria-label={t('stage.close')}
            title={t('stage.close')}
            className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:size-9"
          >
            <CloseIcon />
          </button>
        </div>
        <div
          ref={body}
          onScroll={sayFade}
          style={fade ? { maskImage: fadeOut, WebkitMaskImage: fadeOut } : undefined}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
        >
          <div ref={content} className={className}>
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
