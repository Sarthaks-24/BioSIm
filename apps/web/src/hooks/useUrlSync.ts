import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import i18n from '../i18n/index.ts'
import { useSim, shareQuery } from '../state/sim.ts'
import { DEFAULT_PRESET } from '../lib/presets.ts'

/**
 * Keeps the address bar and the simulator in step, through the router (never behind its back):
 * - a link with meals loads them (and its language);
 * - a bare /sim keeps whatever meals are already open, or opens the default lesson if none;
 * - changing meals, language or (when paused) time rewrites the URL in place, so the address
 *   bar can always be copied as a link.
 *
 * Meal and language changes are written at once. Only time is debounced (dragging the timeline
 * changes it many times a second, and browsers limit how often a page may rewrite its URL). A
 * timer is not reliable for the rest: while the 3D view is busy (a slow phone, the first render)
 * a 250 ms timer can fire seconds late, and someone who copies the link right after adding a
 * food would copy the old meal.
 *
 * The router reports URL changes later than they happen, so an older one can arrive after a
 * newer one. Every query we write is remembered, and any URL change that matches one of them is
 * ours — never mistaken for someone opening a different link.
 *
 * The language is read from the i18next instance itself, not from useTranslation(): that returns
 * a snapshot whose `language` stays what it was at that render, and the listeners below are set
 * up once, on the first render.
 */
export function useUrlSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const ours = useRef(new Set<string>())
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const writeUrl = () => {
    // This writes the latest state, so a pending debounced write has nothing left to do.
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const { a, b, time, playing } = useSim.getState()
    // Both meals emptied still gets written (as just "?v=…"), so a reload doesn't bring them back.
    const query = shareQuery({ a, b, time: playing ? 0 : time }, i18n.language)
    if (`?${query}` === window.location.search) return
    ours.current.add(query)
    if (ours.current.size > 50) ours.current.delete(ours.current.values().next().value!)
    navigateRef.current({ pathname: '/sim', search: `?${query}` }, { replace: true })
  }
  /** For time only: write once the timeline has stopped moving. */
  const writeSoon = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(writeUrl, 250)
  }

  // URL → store
  useEffect(() => {
    const search = location.search.replace(/^\?/, '')
    if (ours.current.has(search)) {
      // One of our own writes landed — possibly an older one. Make sure the URL ends up current
      // (writeUrl does nothing if it already is).
      writeUrl()
      return
    }
    const params = new URLSearchParams(search)
    if (params.has('a') || params.has('b')) {
      const lang = useSim.getState().loadShareState(search)
      if (lang && lang !== i18n.language) void i18n.changeLanguage(lang)
    } else if (!params.has('v')) {
      // A bare /sim (from the menu) keeps open meals, or starts the default lesson. A link with
      // "v" but no meals is a deliberately empty comparison and stays empty.
      const { a, b } = useSim.getState()
      if (a.length === 0 && b.length === 0) {
        useSim.setState({ a: DEFAULT_PRESET.a, b: DEFAULT_PRESET.b, time: 0, playing: false, linkModelVersion: null })
      }
    }
    // Write back the canonical form (this also fills in a bare /sim).
    writeUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to navigation
  }, [location.search])

  // store → URL
  useEffect(() => {
    const unsub = useSim.subscribe((s, prev) => {
      const mealsChanged = s.a !== prev.a || s.b !== prev.b
      const timeSettled = !s.playing && (s.time !== prev.time || s.playing !== prev.playing)
      if (mealsChanged) writeUrl()
      else if (timeSettled) writeSoon()
    })
    i18n.on('languageChanged', writeUrl)
    return () => {
      unsub()
      i18n.off('languageChanged', writeUrl)
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
