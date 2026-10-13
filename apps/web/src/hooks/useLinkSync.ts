import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { MODEL_VERSION } from '@lifepeek/engine'
import i18n from '../i18n/index.ts'
import { linkLanguage } from '../i18n/language.ts'
import { linkQuery, useRunStore } from '../state/run.ts'
import { useClock } from '../state/clock.ts'

/** URL parameters that make a query a link to open (anything else is a bare page). */
const LINK_PARAMS = ['v', 'a', 'b', 'o'] as const

/**
 * Keeps the address bar and the run in step, through the router, so the address bar can always
 * be copied as a link.
 * - a link (`v`, `a`, `b` or `o`) opens its meal, kept run, person, layer, time and language;
 *   `?v=2` with no meals is a deliberately empty run and stays empty;
 * - a bare page keeps the open meal, or opens the default meal if none (a bare `?lang=` still
 *   switches the language; `lang=hi` only in a Hindi build, i18n/language.ts);
 * - it writes `a` (meal), `b` (kept), `t`, and `who` / `layer` only when not the default;
 * - `lang` only when it was chosen (B22): the opened link's own `lang` (kept as it came, so a Hindi
 *   lesson's link stays Hindi while Hindi is paused), or a language picked on the stage; else
 *   `lang=hi` while the page is in Hindi. Never a `lang=en` the link did not have;
 * - Back and Forward never change the run (B6): a sheet's history entry (lib/backCloses.ts) and the
 *   entry under it can hold an older link, so a step between them writes the run back instead of
 *   opening that link.
 *
 * The lessons of v1's link hook (useUrlSync, WP-01; deleted in WP-20), kept here:
 * - Run and language changes are written at once. Only time is debounced: dragging the timeline
 *   changes it many times a second, and browsers limit how often a page may rewrite its URL. A
 *   timer for the rest can fire seconds late while the 3D view is busy, and a link copied right
 *   after adding a food would hold the old meal.
 * - The router reports URL changes late, so an older one can arrive after a newer one. Every
 *   query we write is remembered, and a URL change that matches one is ours.
 * - The language comes from the i18next instance, not from useTranslation()'s snapshot, because
 *   the listeners are set up once.
 * - While playing, `t` is written as 0, so the URL does not change every frame.
 */
export function useLinkSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  /** Whether the URL has been read once (the page's first read is never put off). */
  const read = useRef(false)
  const ours = useRef(new Set<string>())
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  // The page this hook runs on (/sim since WP-19).
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The language the link carries (null: none chosen). */
  const lang = useRef<string | null>(null)

  const writeUrl = () => {
    // This writes the latest state, so a pending debounced write has nothing left to do.
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    // The reader has already left for another page (a menu link right after the stage opened):
    // a late write must not bring them back.
    if (window.location.pathname !== pathRef.current) return
    const { simMin, playing } = useClock.getState()
    // An emptied meal still gets written (as just "?v=…"), so a reload doesn't bring it back.
    const query = linkQuery(useRunStore.getState(), playing ? 0 : simMin, lang.current ?? (i18n.language === 'hi' ? 'hi' : undefined))
    if (`?${query}` === window.location.search) return
    ours.current.add(query)
    if (ours.current.size > 50) ours.current.delete(ours.current.values().next().value!)
    // The entry keeps its state: an open sheet's mark (lib/backCloses.ts).
    navigateRef.current({ pathname: pathRef.current, search: `?${query}` }, { replace: true, state: history.state?.usr })
  }
  /** For time only: write once the timeline has stopped moving. */
  const writeSoon = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(writeUrl, 250)
  }

  // URL → stores
  useEffect(() => {
    // Back or Forward (not the first read): read once every popstate listener has run, so a step
    // between a sheet's entry and its neighbour is known to be ours (lib/backCloses.ts sends
    // `lifepeek:keeprun` after the router has already handed React the new location).
    if (read.current && navigationType === 'POP') {
      const timer = setTimeout(sync)
      return () => clearTimeout(timer)
    }
    read.current = true
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to navigation
  }, [location.search])
  function sync() {
    const search = window.location.search.replace(/^\?/, '')
    if (ours.current.has(search)) {
      // One of our own writes landed, possibly an older one. Make sure the URL ends up current.
      writeUrl()
      return
    }
    const params = new URLSearchParams(search)
    let asked: string | null | undefined
    if (LINK_PARAMS.some((p) => params.has(p))) asked = useRunStore.getState().loadLink(search)
    else {
      useRunStore.getState().openDefault()
      asked = params.get('lang')
    }
    lang.current = asked ?? null
    // While Hindi is paused (R47), a Hindi link opens in English and says so (components/stage/LinkNotes.tsx).
    const wanted = linkLanguage(asked)
    useRunStore.setState({ hindiLater: asked === 'hi' && !wanted })
    if (wanted && wanted !== i18n.language) void i18n.changeLanguage(wanted)
    // A link from a newer LifePeek stays as it came until the reader changes something, so updating
    // (components/stage/LinkNotes.tsx) reloads it whole: this version would leave out what it can't show.
    const { linkModelVersion, unknownOrganism } = useRunStore.getState()
    if (unknownOrganism || (linkModelVersion ?? 0) > MODEL_VERSION) return
    // Write back the canonical form (this also fills in a bare page).
    writeUrl()
  }

  // stores → URL
  useEffect(() => {
    const unsubRun = useRunStore.subscribe((s, prev) => {
      if (s.meal !== prev.meal || s.kept !== prev.kept || s.profile !== prev.profile || s.layer !== prev.layer) writeUrl()
    })
    const unsubClock = useClock.subscribe(
      (s) => (s.playing ? -1 : Math.round(s.simMin)),
      () => writeSoon(),
    )
    const onLanguage = (lng: string) => {
      lang.current = lng
      writeUrl()
    }
    i18n.on('languageChanged', onLanguage)
    // Sent by lib/backCloses.ts on a step between a sheet's entry and its neighbour: the entry it
    // landed on is ours, and gets the run written into it once the router has taken the step (the
    // router may never hand React that entry's URL, if React had not yet drawn the one before it).
    const keepRun = () => {
      ours.current.add(window.location.search.slice(1))
      setTimeout(writeUrl)
    }
    addEventListener('lifepeek:keeprun', keepRun)
    return () => {
      unsubRun()
      unsubClock()
      i18n.off('languageChanged', onLanguage)
      removeEventListener('lifepeek:keeprun', keepRun)
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
