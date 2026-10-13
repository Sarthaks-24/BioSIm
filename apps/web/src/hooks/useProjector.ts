import { useSyncExternalStore } from 'react'
import { readPref, writePref } from '../lib/prefs.ts'

/** True while projector mode is on (`html[data-contrast='high']`). */
export const isProjector = () => document.documentElement.dataset.contrast === 'high'

/**
 * Switches projector mode and remembers it. The Layout's button uses it, and so do the Teach
 * page's ready lessons, which open in projector mode (WP-19).
 */
export function setProjector(on: boolean) {
  document.documentElement.dataset.contrast = on ? 'high' : 'normal'
  writePref('projector', on ? '1' : '0')
}

/** The saved choice, applied once before the first draw (Layout imports this module first). */
if (typeof document !== 'undefined' && !document.documentElement.dataset.contrast)
  document.documentElement.dataset.contrast = readPref('projector') === '1' ? 'high' : 'normal'

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-contrast'] })
  return () => mo.disconnect()
}

/**
 * Projector mode. The Layout's button and the drawings CSS can't reach (the 3D body's shader, the
 * flat body's canvas) follow it; everything else follows it in CSS (styles.css, the
 * `in-data-[contrast=high]:` variant).
 */
export function useProjector(): boolean {
  return useSyncExternalStore(subscribe, isProjector, () => false)
}
