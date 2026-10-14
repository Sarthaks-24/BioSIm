import { Fragment, type ReactNode } from 'react'

// A web address, without punctuation that ends the sentence after it (English or Hindi), or an email
// address. The project email is still "<project email>" (no "@", so plain text) until the user gives
// it (B20, T12b); then it is a mailto: link with no other change.
const ADDRESS = /(https?:\/\/[^\s,]*[^\s.,;:!?।)]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/

/** Turns bare web and email addresses into links (email: mailto:, in this tab). */
function linkify(text: string): ReactNode[] {
  return text.split(ADDRESS).map((part, i) =>
    i % 2 === 0 ? (
      <Fragment key={i}>{part}</Fragment>
    ) : part.includes('@') && !part.includes('/') ? (
      <a key={i} href={`mailto:${part}`} className="break-words underline underline-offset-2">
        {part}
      </a>
    ) : (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-words underline underline-offset-2">
        {part}
      </a>
    ),
  )
}

/**
 * Text from the translation files with just two kinds of markup: **bold** and bare web and email
 * addresses, which become links. Enough for the privacy page, which is copied from a reviewed legal text and
 * must read exactly the same in English and Hindi.
 */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {linkify(part)}
          </strong>
        ) : (
          <Fragment key={i}>{linkify(part)}</Fragment>
        ),
      )}
    </>
  )
}
