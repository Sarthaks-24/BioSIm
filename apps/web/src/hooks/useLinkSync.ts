import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import i18n from '../i18n/index.ts'
import { linkQuery, useRunStore } from '../state/run.ts'
import { useClock } from '../state/clock.ts'

/** URL parameters that make a query a link to open (anything else is a bare page). */
const LINK_PARAMS = ['v', 'a', 'b', 'o'] as const

/**
 * The v2 screen's version of useUrlSync: keeps the address bar and the run in step, through the
 * router, so the address bar can always be copied as a link.
 * - a link (`v`, `a`, `b` or `o`) opens its meal, kept run, person, layer, time and language;
 *   `?v=2` with no meals is a deliberately empty run and stays empty;
 * - a bare page keeps the open meal, or opens the default meal if none (a bare `?lang=` still
 *   switches the language);
 * - it writes `a` (meal), `b` (kept), `t`, `lang`, and `who` / `layer` only when not the default.
 *
 * The lessons of v1's useUrlSync (WP-01), kept here:
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
  const ours = useRef(new Set<string>())
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  // The page this hook runs on (/sim since WP-19).
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const writeUrl = () => {
    // This writes the latest state, so a pending debounced write has nothing left to do.
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    // The reader has already left for another page (a menu link right after the stage opened):
    // a late write must not bring them back.
    if (window.location.pathname !== pathRef.current) return
    const { simMin, playing } = useClock.getState()
    // An emptied meal still gets written (as just "?v=…"), so a reload doesn't bring it back.
    const query = linkQuery(useRunStore.getState(), playing ? 0 : simMin, i18n.language)
    if (`?${query}` === window.location.search) return
    ours.current.add(query)
    if (ours.current.size > 50) ours.current.delete(ours.current.values().next().value!)
    navigateRef.current({ pathname: pathRef.current, search: `?${query}` }, { replace: true })
  }
  /** For time only: write once the timeline has stopped moving. */
  const writeSoon = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(writeUrl, 250)
  }

  // URL → stores
  useEffect(() => {
    const search = location.search.replace(/^\?/, '')
    if (ours.current.has(search)) {
      // One of our own writes landed, possibly an older one. Make sure the URL ends up current.
      writeUrl()
      return
    }
    const params = new URLSearchParams(search)
    let lang: string | null | undefined
    if (LINK_PARAMS.some((p) => params.has(p))) lang = useRunStore.getState().loadLink(search)
    else {
      useRunStore.getState().openDefault()
      lang = params.get('lang')
    }
    if ((lang === 'en' || lang === 'hi') && lang !== i18n.language) void i18n.changeLanguage(lang)
    // Write back the canonical form (this also fills in a bare page).
    writeUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to navigation
  }, [location.search])

  // stores → URL
  useEffect(() => {
    const unsubRun = useRunStore.subscribe((s, prev) => {
      if (s.meal !== prev.meal || s.kept !== prev.kept || s.profile !== prev.profile || s.layer !== prev.layer) writeUrl()
    })
    const unsubClock = useClock.subscribe(
      (s) => (s.playing ? -1 : Math.round(s.simMin)),
      () => writeSoon(),
    )
    i18n.on('languageChanged', writeUrl)
    return () => {
      unsubRun()
      unsubClock()
      i18n.off('languageChanged', writeUrl)
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
