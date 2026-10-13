import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import RichText from '../components/RichText.tsx'
import { FOODS } from '../data/foods.ts'
import { addEnglish, LANGUAGES } from '../i18n/index.ts'
import { REPO_URL } from '../lib/site.ts'
import statsText from 'virtual:lifepeek-en/stats'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(statsText)

/** One ISO week (Monday to Sunday, UTC) of mistake reports. */
interface Week {
  week: string
  /** Monday, "YYYY-MM-DD". */
  start: string
  reported: number
  fixed: number
}

/** public/stats.json as scripts/fetch-stats.mjs writes it when GitHub could be read. */
interface StatsFile {
  available: true
  generatedAt: string
  weeks: Week[]
  totals: { reported: number; fixed: number }
  medianDaysToFix: number | null
  lastRelease: { tag: string; date: string } | null
}

type State = { status: 'loading' } | { status: 'unavailable' } | { status: 'failed' } | { status: 'ready'; stats: StatsFile }

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

/** Anything that isn't a complete stats file (including { available: false }) shows as "not yet". */
function parse(data: unknown): StatsFile | null {
  const s = data as Partial<StatsFile> | null
  if (!s || s.available !== true || typeof s.generatedAt !== 'string' || !Array.isArray(s.weeks) || !s.weeks.length) return null
  if (!s.weeks.every((w) => typeof w?.start === 'string' && isCount(w.reported) && isCount(w.fixed))) return null
  if (!s.totals || !isCount(s.totals.reported) || !isCount(s.totals.fixed)) return null
  return {
    available: true,
    generatedAt: s.generatedAt,
    weeks: s.weeks,
    totals: s.totals,
    medianDaysToFix: isCount(s.medianDaysToFix) ? s.medianDaysToFix : null,
    lastRelease: typeof s.lastRelease?.tag === 'string' && typeof s.lastRelease.date === 'string' ? s.lastRelease : null,
  }
}

/**
 * The numbers come from a file on this same site, written when the site is built. This page never
 * talks to GitHub or anyone else. Offline, the service worker gives the last copy it saw.
 */
function useStatsFile(attempt: number): State {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading' })
    fetch('/stats.json', { signal: ctrl.signal, cache: 'no-cache' })
      .then(async (res) => {
        // No file (a build without it) or a broken one: same as "not counted yet".
        const stats = res.ok ? parse(await res.json().catch(() => null)) : null
        setState(stats ? { status: 'ready', stats } : { status: 'unavailable' })
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: 'failed' })
      })
    return () => ctrl.abort()
  }, [attempt])
  return state
}

/** Twelve weekly counts as small columns: a shape to glance at. The table below has the numbers. */
function Columns({ values }: { values: number[] }) {
  const W = 6
  const GAP = 3
  const H = 32
  const max = Math.max(1, ...values)
  const width = values.length * (W + GAP) - GAP
  return (
    <svg
      viewBox={`0 0 ${width} ${H + 1}`}
      width={width * 1.5}
      height={(H + 1) * 1.5}
      aria-hidden="true"
      className="mt-3 block h-auto max-w-full"
    >
      <line x1={0} x2={width} y1={H + 0.5} y2={H + 0.5} stroke="var(--color-rule)" strokeWidth={1} />
      {values.map((v, i) => {
        if (!v) return null
        const h = Math.max(3, (v / max) * H)
        const x = i * (W + GAP)
        const r = 1.5
        // Rounded at the top, square on the baseline.
        const d = `M${x},${H}V${H - h + r}Q${x},${H - h} ${x + r},${H - h}H${x + W - r}Q${x + W},${H - h} ${x + W},${H - h + r}V${H}Z`
        return <path key={i} d={d} fill={i === values.length - 1 ? 'var(--color-ink)' : 'var(--color-ink-2)'} />
      })}
    </svg>
  )
}

interface TileProps {
  label: string
  value: string
  note?: string
  /** Takes the whole row on a phone (the third tile of a two-column grid). */
  wide?: boolean
  children?: React.ReactNode
}

/** One headline number: what it counts, the number, and what it covers. */
function Tile({ label, value, note, wide, children }: TileProps) {
  return (
    <div className={`rounded-xl border border-rule bg-panel px-4 py-3 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <dt className="text-sm font-semibold text-ink-2">{label}</dt>
      <dd className="mt-1 text-4xl font-extrabold tracking-tight">{value}</dd>
      {note && <dd className="mt-1 text-sm text-ink-2">{note}</dd>}
      {children && <dd>{children}</dd>}
    </div>
  )
}

/** Public numbers only: mistake reports from GitHub issues, and facts about this version of the app. */
export default function Stats() {
  const { t, i18n } = useTranslation()
  const [attempt, setAttempt] = useState(0)
  const state = useStatsFile(attempt)
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'
  const day = (iso: string, withYear = false) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).format(
      new Date(iso),
    )
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)

  const h2 = 'mt-10 mb-3 text-2xl font-extrabold'
  const link = 'underline underline-offset-2 hover:text-ink'
  const message = 'rounded-xl border border-dashed border-rule px-4 py-3'
  const stats = state.status === 'ready' ? state.stats : null
  const weeks = stats?.weeks.length ?? 12
  // Facts about this build. The last release is only known from the weekly file.
  const facts: [string, string][] = [
    [t('stats.modelVersion'), String(MODEL_VERSION)],
    [t('stats.foods'), number(FOODS.length)],
    [t('stats.languages'), `${number(LANGUAGES.length)} (${t('stats.languageNames')})`],
  ]
  if (stats) {
    const r = stats.lastRelease
    facts.push([t('stats.lastRelease'), r ? `${r.tag} · ${day(r.date, true)}` : t('stats.noRelease')])
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-extrabold tracking-tight">{t('stats.title')}</h1>
      <p className="mt-4 max-w-[68ch] text-lg text-ink-2">{t('stats.lead')}</p>

      <p className="mt-6 max-w-[68ch] rounded-xl border border-rule bg-panel px-4 py-3 text-lg">
        <RichText text={t('stats.noTracking')} />
      </p>

      <section aria-labelledby="stats-mistakes" aria-busy={state.status === 'loading'}>
        <h2 id="stats-mistakes" className={h2}>
          {t('stats.mistakesTitle')}
        </h2>
        <p className="max-w-[68ch]">{t('stats.mistakesLead', { weeks })}</p>

        <div className="mt-5" role="status">
          {state.status === 'loading' && <p className="text-ink-2">{t('stats.loading')}</p>}
          {state.status === 'unavailable' && <p className={message}>{t('stats.unavailable')}</p>}
          {state.status === 'failed' && (
            <div className={`${message} flex flex-wrap items-center gap-x-4 gap-y-2`}>
              <p>{t('stats.failed')}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="rounded-full border border-rule px-3 py-1.5 text-sm font-semibold hover:bg-sunk"
              >
                {t('stats.retry')}
              </button>
            </div>
          )}
        </div>

        {stats && (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label={t('stats.reported')} value={number(stats.totals.reported)} note={t('stats.lastWeeks', { weeks })}>
                <Columns values={stats.weeks.map((w) => w.reported)} />
              </Tile>
              <Tile label={t('stats.fixed')} value={number(stats.totals.fixed)} note={t('stats.lastWeeks', { weeks })}>
                <Columns values={stats.weeks.map((w) => w.fixed)} />
              </Tile>
              <Tile
                wide
                label={t('stats.medianDays')}
                value={stats.medianDaysToFix === null ? '–' : number(stats.medianDaysToFix)}
                note={stats.medianDaysToFix === null ? t('stats.noFixes') : t('stats.medianNote')}
              />
            </dl>

            <div className="mt-6 overflow-x-auto">
              <table className="tabular w-full max-w-md text-sm">
                <caption className="mb-2 text-left text-base font-semibold">{t('stats.tableTitle')}</caption>
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th scope="col" className="py-2 pr-3">
                      {t('stats.weekCol')}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      {t('stats.reported')}
                    </th>
                    <th scope="col" className="py-2 text-right">
                      {t('stats.fixed')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.weeks.map((w, i) => (
                    <tr key={w.start} className="border-b border-rule">
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                        {day(w.start)}
                        {i === stats.weeks.length - 1 && <span className="text-ink-2"> ({t('stats.thisWeek')})</span>}
                      </th>
                      <td className="py-1.5 pr-3 text-right">{w.reported}</td>
                      <td className="py-1.5 text-right">{w.fixed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-ink-2">
              {t('stats.updated', { date: day(stats.generatedAt, true) })}{' '}
              <a href={`${REPO_URL}/issues?q=label%3Amistake-report`} target="_blank" rel="noreferrer" className={link}>
                {t('stats.source')}
              </a>
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="stats-version">
        <h2 id="stats-version" className={h2}>
          {t('stats.factsTitle')}
        </h2>
        <dl className="max-w-md border-t border-rule">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  )
}
