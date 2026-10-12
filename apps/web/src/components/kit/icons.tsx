import type { ReactNode, SVGProps } from 'react'

/**
 * The kit's icons: drawn here on one 20 px grid with one 2 px round stroke, so they match each
 * other and look the same on every phone (text glyphs like ✕ or ▶ change with the font, and
 * Devanagari fonts draw some of them differently). Always decorative: the button carries the name.
 */
function Icon({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const PlayIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M6.5 3.9c0-.8.9-1.3 1.6-.9l8.4 5.3c.6.4.6 1.3 0 1.7l-8.4 5.3c-.7.4-1.6-.1-1.6-.9z" />
  </Icon>
)

export const PauseIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <rect x="4.5" y="3.5" width="3.75" height="13" rx="1.2" />
    <rect x="11.75" y="3.5" width="3.75" height="13" rx="1.2" />
  </Icon>
)

export const ChevronDownIcon = () => (
  <Icon width="16" height="16">
    <path d="m5.5 8 4.5 4.5L14.5 8" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon width="16" height="16">
    <path d="m5.5 5.5 9 9m0-9-9 9" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icon>
)

export const InfoIcon = () => (
  <Icon width="18" height="18" strokeWidth="1.75">
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9v4.5" />
    <circle cx="10" cy="6.25" r="0.4" fill="currentColor" />
  </Icon>
)

/** Keep to compare: a solid line over a dashed one (this meal, and the kept run it will draw). */
export const KeepIcon = () => (
  <Icon>
    <path d="M3 7.5h14" />
    <path d="M3 13.5h3m3.5 0h3m3.5 0h1" />
  </Icon>
)

/** Copy link: two chain links. */
export const LinkIcon = () => (
  <Icon width="18" height="18">
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon width="18" height="18">
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="m12.75 12.75 4 4" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon width="16" height="16">
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Icon>
)
