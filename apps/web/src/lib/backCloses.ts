import { useEffect, useRef } from 'react'

/**
 * Back closes the open sheet (FP-6, bug B6): on a phone, Back with the food search or a sheet open
 * left the app. Each sheet adds a history entry while it is open, with the page's own URL and the
 * router's state plus a mark (`usr.sheet`: how many sheets are open). Back takes that entry off and
 * closes the sheet; closing it on the page (✕, Esc, a choice) takes the entry off too, so Back
 * after that does what it did before the sheet opened.
 *
 * Back never changes the run (never undoes a meal): the entry under a sheet's can hold an older
 * link (a food was added while the sheet was open), and so can a sheet's entry left behind for
 * Forward. A step between the two sends `lifepeek:keeprun`, and the link sync (hooks/useLinkSync.ts)
 * writes the run into that entry instead of opening its link. (The router hears of the step first:
 * the link sync reads a Back or Forward only after every listener has run.)
 * The link sync keeps the mark when it rewrites an entry.
 *
 * Only the sheets use this, so it loads with them (components/stage/Sheets.tsx; size budget).
 */

type HistoryState = { usr?: { sheet?: number } } | null
const mark = (state: HistoryState) => state?.usr?.sheet ?? 0

/** The open sheets' close functions, the last on top; each has its own history entry. */
const open: (() => void)[] = []
/** history.back() calls of our own (a sheet closed on the page) whose step has not arrived yet. */
let backs = 0
/** Whether the current entry is a sheet's. */
let onSheet = mark(history.state) > 0

addEventListener('popstate', (e) => {
  const landed = mark(e.state)
  if (onSheet || landed) dispatchEvent(new Event('lifepeek:keeprun'))
  onSheet = landed > 0
  if (backs) return void backs--
  // Back (or Forward) left the top sheet's entry: close it, and any above the entry landed on.
  while (open.length > landed) open.pop()!()
})

/** Gives the sheet that calls it a history entry while it is mounted: Back calls `close`. */
export function useBackCloses(close: () => void) {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    const entry = () => latest.current()
    open.push(entry)
    const state = history.state
    history.pushState({ ...state, usr: { ...state?.usr, sheet: open.length } }, '')
    onSheet = true
    return () => {
      const at = open.indexOf(entry)
      // Back closed it: its entry is gone already.
      if (at < 0) return
      open.splice(at, 1)
      // Closed on the page: its entry goes too, if it is still the one on top (a link inside the
      // sheet may have opened another page instead).
      if (mark(history.state) === at + 1) {
        backs++
        history.back()
      }
    }
  }, [])
}
