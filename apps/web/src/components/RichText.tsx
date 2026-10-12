import { Fragment, type ReactNode } from 'react'

// A web address, without punctuation that ends the sentence after it (English or Hindi).
const WEB_ADDRESS = /(https?:\/\/[^\s,]*[^\s.,;:!?।)])/

/** Turns bare web addresses into links. */
function linkify(text: string): ReactNode[] {
  return text.split(WEB_ADDRESS).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-words underline underline-offset-2">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/**
 * Text from the translation files with just two kinds of markup: **bold** and bare web addresses,
 * which become links. Enough for the privacy page, which is copied from a reviewed legal text and
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
