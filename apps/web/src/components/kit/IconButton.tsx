import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** An icon from ./icons.tsx. */
  icon: ReactNode
  /** The button's name. Shown next to the icon, or (with `iconOnly`) used as its accessible name and tooltip. */
  label: string
  /** Hide the words: only for actions everyone knows by their icon (close, add). */
  iconOnly?: boolean
  /** For a button that opens something and gets focus back (React 19 passes refs as props). */
  ref?: Ref<HTMLButtonElement>
}

/**
 * The kit's button: flat, 6 px corners, no border. Ink text on the page; a Sunk fill on hover.
 * As a toggle (pass `aria-pressed`) the pressed state is filled ink with white text, which reads
 * from the back of a classroom. Touch targets: 44 px on phones, 36 px from 1024 px up.
 */
export default function IconButton({ icon, label, iconOnly = false, className = '', type = 'button', ref, ...rest }: Props) {
  const shape = iconOnly ? 'size-11 justify-center lg:size-9' : 'min-h-11 gap-1.5 pr-3 pl-2.5 lg:min-h-9'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={`inline-flex shrink-0 items-center rounded-control text-control font-semibold whitespace-nowrap text-ink hover:bg-surface-sunk disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent aria-pressed:bg-ink aria-pressed:text-white aria-pressed:hover:bg-ink ${shape} ${className}`}
      {...rest}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  )
}
