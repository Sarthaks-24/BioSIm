import { useEffect, useState } from 'react'
import type * as BoutMarks from './BoutMarks.tsx'

/**
 * The activity bouts' marks on the graphs and the timeline (BoutMarks.tsx) are downloaded the
 * first time a run has a bout (R71/R74: load on demand; the pack-manifest's lazy tier). Until then,
 * or if they can't arrive, the chips and the moments still name every bout; a failed download is
 * tried again when the internet comes back or the run changes (R93 #12).
 */
let marks: typeof BoutMarks | null = null
let loading: Promise<void> | null = null

/** BoutMarks once it is here (it starts the download when `on`), else null. `run`: a new run tries a failed download again. */
export function useBoutMarks(on: boolean, run?: unknown): typeof BoutMarks | null {
  const [, arrived] = useState(0)
  const [tries, retry] = useState(0)
  useEffect(() => {
    if (!on || marks) return
    let live = true
    const again = () => retry((n) => n + 1)
    loading ??= import('./BoutMarks.tsx').then((m) => void (marks = m))
    loading.then(
      () => live && arrived((n) => n + 1),
      () => {
        loading = null
        if (live) window.addEventListener('online', again, { once: true })
      },
    )
    return () => {
      live = false
      window.removeEventListener('online', again)
    }
  }, [on, run, tries])
  return on ? marks : null
}
