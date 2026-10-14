import { useEffect, useState } from 'react'
import type * as BoutMarks from './BoutMarks.tsx'

/**
 * The activity bouts' marks on the graphs and the timeline (BoutMarks.tsx) are downloaded the
 * first time a run has a bout (R71/R74: load on demand; the pack-manifest's lazy tier). Until then,
 * or if they can't arrive, the chips and the moments still name every bout.
 */
let marks: typeof BoutMarks | null = null
let loading: Promise<void> | null = null

/** BoutMarks once it is here (it starts the download when `on`), else null. */
export function useBoutMarks(on: boolean): typeof BoutMarks | null {
  const [, arrived] = useState(0)
  useEffect(() => {
    if (!on || marks) return
    loading ??= import('./BoutMarks.tsx').then(
      (m) => void (marks = m),
      () => void (loading = null),
    )
    let live = true
    void loading.then(() => live && arrived(1))
    return () => void (live = false)
  }, [on])
  return on ? marks : null
}
