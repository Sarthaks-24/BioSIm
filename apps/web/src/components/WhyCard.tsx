import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import whyText from 'virtual:lifepeek-en/why'
import { addEnglish } from '../i18n/text.ts'

/**
 * The cards' shared words and Digestion's card, added the first time a card is drawn (not when this
 * file loads: the packs' unit tests import it without an i18next instance).
 */
let added = false
function addWords() {
  if (!added) addEnglish(whyText)
  added = true
}

/** One row of a card: what is compared, the book's value (with its source), the model's, and why they differ. */
interface WhyRow {
  what: string
  book: string
  model: string
  why: string
}

/**
 * "Why different? ›" and its "Why does the model differ from the book?" card (X-4; ui-ux §8.4,
 * content-i18n §8.5, R9): by a book line on the stage (Breathing, Heart & blood, Skin, Kidneys) and
 * in the guided lesson's bar. `text` names the card's words: `sys.<pack>.why` in its pack's own
 * section, which loads with the pack, or `why.digestion` (the core has no pack section, so
 * Digestion's card comes with this file's `why` section). The card's rows are read from those
 * words in their order: each row's `what`, `book`, `model` and `why`, then the exam line and the
 * card's `ask`, a question to discuss.
 *
 * It rides in the chunk of whatever imports it (a pack, the lesson bar) and imports no stage
 * module, so /sim's first download does not grow (flat/layerKit.ts says why). The book is named,
 * never "your book" (R9; strings.test checks every screen string).
 */
export default function WhyCard({ text, className = '' }: { text: string; className?: string }) {
  addWords()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const cardId = useId()
  const words = t(text, { returnObjects: true }) as unknown
  const card = words && typeof words === 'object' ? (words as Record<string, unknown>) : {}
  const rows = Object.entries(card).filter((e): e is [string, WhyRow] => !!e[1] && typeof e[1] === 'object')
  const ask = typeof card.ask === 'string' ? card.ask : null
  return (
    <>
      <button
        type="button"
        data-why-open={text}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => setOpen((o) => !o)}
        // 44 px to touch on a phone, a text-sized link from 1024 px up (as "Count yours" beside it).
        className={`inline-flex min-h-11 items-center self-start font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink lg:min-h-0 ${className}`}
      >
        {t('why.open')}
      </button>
      {open && (
        <section
          id={cardId}
          data-why={text}
          aria-label={t('why.title')}
          className="order-last basis-full rounded-control bg-surface-sunk px-2 py-1.5 text-ink"
        >
          <h3 className="font-semibold">{t('why.title')}</h3>
          <dl className="mt-1 flex flex-col gap-1.5">
            {rows.map(([key, row]) => (
              <div key={key} data-why-row={key}>
                <dt className="font-semibold">{row.what}</dt>
                <dd data-why-book="">
                  {t('why.book')}: {row.book}
                </dd>
                <dd data-why-model="">
                  {t('why.model')}: {row.model}
                </dd>
                <dd className="text-ink-muted">
                  {t('why.reason')}: {row.why}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 font-semibold">{t('why.exam')}</p>
          {ask && <p className="text-ink-muted">{ask}</p>}
        </section>
      )}
    </>
  )
}
