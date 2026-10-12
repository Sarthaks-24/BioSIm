import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

interface Props {
  /** The button that opened it: the popover sits under it and focus goes back to it on close. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  /** Names the panel for screen readers. */
  label: string
  children: ReactNode
  className?: string
}

/**
 * A small panel under a button (servings, "Adult model" info). Fixed to the window, so the meal
 * bar's sideways scroll can't clip it; kept inside the window at any width. Closes on Esc, on a
 * press outside it, or when the page scrolls or resizes; focus returns to the button.
 */
export default function Popover({ anchor, onClose, label, children, className = '' }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const close = useRef(onClose)
  close.current = onClose

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

  useEffect(() => {
    const anchorEl = anchor.current
    const done = (refocus: boolean) => {
      close.current()
      if (refocus) anchorEl?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        done(true)
      }
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target) || anchorEl?.contains(target)) return
      done(false)
    }
    const onMove = () => done(false)
    // Focus the first control inside, so keyboard users land in the panel.
    panel.current?.querySelector<HTMLElement>('button, a, input')?.focus()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onMove)
    // Any scroll moves the button away from the panel (the meal bar's chips scroll sideways).
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onMove)
    }
  }, [anchor])

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      className={`fixed z-40 max-w-[calc(100vw-1rem)] rounded-control border border-rule2 bg-shelf p-3 text-ink ${className}`}
    >
      {children}
    </div>
  )
}
