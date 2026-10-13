import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** The button that opened it (or a box around it): the popover sits under it and focus goes back to it on close. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  /** Names the panel for screen readers. */
  label: string
  children: ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'

/** The control focus goes back to: the anchor itself, or the first control inside it (a chip's edit button). */
function triggerOf(anchor: HTMLElement | null): HTMLElement | null {
  if (!anchor) return null
  return anchor.matches(FOCUSABLE) ? anchor : anchor.querySelector<HTMLElement>(FOCUSABLE)
}

/**
 * A small panel under a button (servings, "Typical adult" info, "How we know"). Fixed to the window,
 * so the meal bar's sideways scroll can't clip it; kept inside the window at any width.
 *
 * Keyboard and screen readers: the panel itself takes focus once it is placed, so its name and
 * text are read from the top (not from its first link, which may be at the bottom). Tab moves
 * through its controls; tabbing past the first or last one, Esc, or focus going anywhere else
 * closes it. It closes on a press outside it too, or when the page scrolls or resizes. Closing
 * from the keyboard puts focus back on the button that opened it: the panel lives at the end of
 * <body>, so without that, Tab would leave the page.
 */
export default function Popover({ anchor, onClose, label, children, className = '' }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const placed = pos !== null

  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect()
    const p = panel.current
    if (!a || !p) return
    const margin = 8
    const left = Math.max(margin, Math.min(a.left, window.innerWidth - p.offsetWidth - margin))
    // Below the button if it fits, else above it.
    const below = a.bottom + 6
    const top = below + p.offsetHeight > window.innerHeight - margin ? Math.max(margin, a.top - 6 - p.offsetHeight) : below
    setPos({ top, left })
  }, [anchor])

  // Focus the panel once it is visible (a hidden element can't take focus).
  useEffect(() => {
    if (placed) panel.current?.focus({ preventScroll: true })
  }, [placed])

  useEffect(() => {
    const anchorEl = anchor.current
    const panelEl = panel.current
    let closed = false
    const done = (refocus: boolean) => {
      if (closed) return
      closed = true
      close.current()
      if (refocus) triggerOf(anchorEl)?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        done(true)
      }
    }
    // Tab past the last control (or Shift+Tab before the first) leaves the panel: back to the button.
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelEl) return
      const controls = [...panelEl.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const at = document.activeElement
      const leaving = e.shiftKey ? at === panelEl || at === controls[0] : controls.length === 0 || at === controls.at(-1)
      if (leaving) {
        e.preventDefault()
        done(true)
      }
    }
    // Focus moved elsewhere (a click, a screen reader's own cursor): close. Back to the button only
    // if focus left the page; a click on the button itself toggles it as usual.
    const onFocusOut = (e: FocusEvent) => {
      const to = e.relatedTarget as Node | null
      if (to && (panelEl?.contains(to) || anchorEl?.contains(to))) return
      // Not when the panel (or the control in it) is being taken away, nor when the whole window
      // lost focus (switching apps): only focus moving elsewhere in the page.
      queueMicrotask(() => {
        if (panelEl?.isConnected && document.hasFocus() && !panelEl.contains(document.activeElement)) done(to === null)
      })
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target) || anchorEl?.contains(target)) return
      done(false)
    }
    const onMove = () => done(false)
    // Scrolling inside the panel itself (a long "How we know") keeps it open.
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) done(false)
    }
    window.addEventListener('keydown', onKey)
    panelEl?.addEventListener('keydown', onTab)
    panelEl?.addEventListener('focusout', onFocusOut)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onMove)
    // Any scroll moves the button away from the panel (the meal bar's chips scroll sideways).
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
      panelEl?.removeEventListener('keydown', onTab)
      panelEl?.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onMove)
    }
  }, [anchor])

  // In <body>, so a parent with CSS containment (the graph column) can never clip or move it.
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      className={`fixed z-40 max-w-[calc(100vw-1rem)] rounded-control border border-rule2 bg-shelf p-3 text-ink focus:outline-none ${className}`}
    >
      {children}
    </div>,
    document.body,
  )
}
