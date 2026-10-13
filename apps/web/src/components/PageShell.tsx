import type { ReactNode } from 'react'

/**
 * The one container for the content pages (FP-10): Home, Teach, Science, About, Privacy, Stats and
 * the not-found and error pages. The site header and footer span the window on every page, as on
 * the stage, so the logo never moves; a content page centres its own column inside that, with the
 * header's 16 px gutter. Widths:
 * - `text`: a reading column (68ch lines inside it), for the text pages;
 * - `table`: a little wider, for Science's foods table;
 * - `wide`: Home's sections side by side;
 * - `note`: one short centred message.
 */
const WIDTH = {
  text: 'max-w-3xl py-10 leading-relaxed',
  table: 'max-w-4xl py-10 leading-relaxed',
  wide: 'max-w-7xl',
  note: 'max-w-xl py-20 text-center',
} as const

export default function PageShell({
  width = 'text',
  as: Tag = 'article',
  children,
}: {
  width?: keyof typeof WIDTH
  as?: 'article' | 'div'
  children: ReactNode
}) {
  return <Tag className={`mx-auto px-4 ${WIDTH[width]}`}>{children}</Tag>
}
