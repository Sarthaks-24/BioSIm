import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { sourceById, type ProfileId, type SignalMeta, type SourceId } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { unitInWords } from '../../lib/formatSignal.ts'
import { InfoIcon, StatusTag } from '../kit/index.ts'
import Popover from '../stage/Popover.tsx'

/**
 * A source's short name for a link: "Freckmann 2007", "FAO/WHO/UNU 2004", "OpenStax". The author
 * (or body) is the citation up to its first comma or full stop, without trailing initials; the
 * year comes from the source's ID.
 */
export function sourceLabel(id: SourceId, lang: string): string {
  if (id.startsWith('food:')) return localized(lookupFood(id.slice(5))?.name, lang) || id.slice(5)
  const entry = sourceById(id)
  if (!entry) return id
  const who = entry.citation.split(/[,.]/)[0]!.replace(/\s+[A-Z]{1,3}$/, '')
  const year = /\d{4}/.exec(id)?.[0]
  return year ? `${who} ${year}` : who
}

/** Where a source is listed in full: its anchor on the Science page (pages/Science.tsx). */
export const sourceHref = (id: SourceId) => `/science#${encodeURIComponent(id)}`

interface Props {
  meta: SignalMeta
  /** The run's sources: the signal's own plus `food:<id>` for each food in the meal. */
  sourceIds: readonly SourceId[]
  profile: ProfileId
  /** What the marks on this graph mean, and other graph-specific limits. */
  notes?: ReactNode
  /** The graph's name, when it is not the signal's (a two-line graph). */
  title?: string
}

/**
 * The ⓘ "How we know" panel of one graph (G3): what the line means, its unit in words, how sure
 * we are, the known limits, whose body it is, and the sources (each linked to its entry on the
 * Science page). Long caveats live here instead of under the graph.
 */
export default function HowWeKnow({ meta, sourceIds, profile, notes, title }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const name = title ?? t(`${meta.i18nKey}.name`)
  const label = t('graph.howFor', { name })
  const papers = sourceIds.filter((id) => !id.startsWith('food:'))
  const foods = sourceIds.filter((id) => id.startsWith('food:'))

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((o) => !o)}
        // 44 px to touch on a phone; 28 px from 1024 px up, pulled into the header line so it adds no height.
        className="-my-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-sunk2 hover:text-ink aria-expanded:bg-sunk2 aria-expanded:text-ink lg:-my-1 lg:size-7"
      >
        <InfoIcon />
      </button>
      {open && (
        <Popover
          anchor={button}
          onClose={() => setOpen(false)}
          label={label}
          className="w-[26rem] max-h-[min(34rem,75dvh)] overflow-y-auto"
        >
          <div className="flex flex-col gap-3 text-caption leading-relaxed text-ink-2">
            <h3 className="text-control font-semibold text-ink">{label}</h3>
            <p className="text-ink">{t(`${meta.i18nKey}.desc`)}</p>
            <Section title={t('graph.unit')}>{t('graph.unitIs', { unit: meta.unit, words: unitInWords(meta.unit, t) })}</Section>
            <Section title={t('graph.howSure')}>
              <span className="flex flex-col gap-1">
                <StatusTag status={meta.status} />
                {t(`status.${meta.status}.help`)}
              </span>
            </Section>
            {meta.band && (
              <Section title={t(`${meta.band.i18nKey}.name`)}>
                <span className="flex flex-col gap-1">
                  <StatusTag status={meta.band.status} />
                  {/* Blood sugar's band is the only one so far. */}
                  {t('limits.glucoseBand')}
                </span>
              </Section>
            )}
            {notes}
            {meta.limitKey && <Section title={t('graph.limits')}>{t(meta.limitKey)}</Section>}
            <Section title={t(`profiles.${profile}.tag`)}>{t(`profiles.${profile}.desc`)}</Section>
            <Section title={t('graph.sources')}>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {papers.map((id) => (
                  <li key={id}>
                    <Link to={sourceHref(id)} className="text-ink underline underline-offset-2">
                      {sourceLabel(id, i18n.language)}
                    </Link>
                  </li>
                ))}
              </ul>
              {foods.length > 0 && (
                <p className="mt-1">
                  {t('graph.foodData')}{' '}
                  {foods.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <Link to={sourceHref(id)} className="text-ink underline underline-offset-2">
                        {sourceLabel(id, i18n.language)}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </Section>
          </div>
        </Popover>
      )}
    </>
  )
}

/** One labelled part of the panel. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="font-semibold text-ink">{title}</h4>
      <div>{children}</div>
    </section>
  )
}
