import { Suspense, useState } from 'react'
import { LoadBoundary, LoadFailedBox, lazyWithRetry } from '../LoadBoundary.tsx'
import type { OverlayProps } from '../Overlay.tsx'

/** The panel's code is downloaded the first time one opens: it is not part of the first paint (FP-5, size budget). */
const overlay = lazyWithRetry<OverlayProps>(() => import('../Overlay.tsx'))

/**
 * A small panel opened by a button ("How we know", "⋯", servings, the "+n" list): a popover from
 * 1024 px up, a sheet from the bottom below (components/Overlay.tsx says how it behaves). If its
 * code doesn't arrive, a small box low in the window says so, with "Try again" and "Close".
 */
export default function Popover(props: OverlayProps) {
  const [attempt, setAttempt] = useState(0)
  return (
    <LoadBoundary
      key={attempt}
      onFail={overlay.reset}
      fallback={<LoadFailedBox attempt={attempt} onRetry={() => setAttempt((n) => n + 1)} onClose={props.onClose} />}
    >
      <Suspense fallback={null}>
        <overlay.Component {...props} />
      </Suspense>
    </LoadBoundary>
  )
}
