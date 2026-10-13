import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { sourceById, type ProfileId, type SignalMeta, type SourceId } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { addEnglish, localized } from '../../i18n/index.ts'
import graphText from 'virtual:lifepeek-en/graph'
import limitsText from 'virtual:lifepeek-en/limits'
import profilesText from 'virtual:lifepeek-en/profiles'
import signalsText from 'virtual:lifepeek-en/signals'
import unitsText from 'virtual:lifepeek-en/units'
import { unitInWords } from '../../lib/formatSignal.ts'
import { StatusTag } from '../kit/index.ts'
import Overlay from '../Overlay.tsx'
import { Section } from './HowWeKnow.tsx'

// The known limits', the signals' and the rings' long English, the panel's own words, the units in
// words and whose body it is come with the panel, the only place that shows them (whose body: the
// "⋯" panel too).
addEnglish(graphText, limitsText, profilesText, signalsText, unitsText)

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

export interface PanelProps {
  meta: SignalMeta
  /** The run's sources: the signal's own plus `food:<id>` for each food in the meal. */
  sourceIds: readonly SourceId[]
  profile: ProfileId
  /** What the marks on this graph mean. */
  notes?: ReactNode
  /** Known limits of this graph beyond its signal's own (`limitKey`), as `limits.*` keys (their text loads with this panel). */
  limits?: readonly string[]
}

/**
 * The ⓘ "How we know" panel of one graph (G3): what the line means, its unit in words, how sure
 * we are, the known limits, whose body it is, and the sources (each linked to its entry on the
 * Science page). Long caveats live here instead of under the graph.
 *
 * Loaded the first time a panel opens (HowWeKnow.tsx), with the source list and the panel frame
 * (Overlay): nobody needs it to see the graphs, and it keeps the simulator's first download inside its budget.
 */
export default function HowWeKnowPanel({
  meta,
  sourceIds,
  profile,
  notes,
  limits = [],
  anchor,
  label,
  onClose,
}: PanelProps & { anchor: RefObject<HTMLButtonElement | null>; label: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const papers = sourceIds.filter((id) => !id.startsWith('food:'))
  const foods = sourceIds.filter((id) => id.startsWith('food:'))

  return (
    // Its title ("How we know: Blood sugar") is the panel's top row, beside "Close" (Overlay).
    <Overlay
      anchor={anchor}
      onClose={onClose}
      label={label}
      width="w-[26rem]"
      className="flex flex-col gap-3 text-caption leading-relaxed text-ink-muted"
    >
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
      {(meta.limitKey || limits.length > 0) && (
        <Section title={t('graph.limits')}>
          <span className="flex flex-col gap-1">
            {meta.limitKey && <span>{t(meta.limitKey)}</span>}
            {limits.map((l) => (
              <span key={l}>{t(l)}</span>
            ))}
          </span>
        </Section>
      )}
      {/* After this line's own limits, so they are not read as the limits of a second line in the notes (energy used at rest). */}
      {notes}
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
    </Overlay>
  )
}
