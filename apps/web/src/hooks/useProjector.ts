import { useSyncExternalStore } from 'react'

/** True while projector mode is on (Layout sets `html[data-contrast='high']`). */
export const isProjector = () => document.documentElement.dataset.contrast === 'high'

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-contrast'] })
  return () => mo.disconnect()
}

/**
 * Projector mode, for drawings CSS can't reach (the 3D body's shader, the flat body's canvas).
 * Everything else follows it in CSS (styles.css, the `in-data-[contrast=high]:` variant).
 */
export function useProjector(): boolean {
  return useSyncExternalStore(subscribe, isProjector, () => false)
}
