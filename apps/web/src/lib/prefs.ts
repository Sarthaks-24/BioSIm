/**
 * Per-device conveniences only (language, projector mode). Storage can be unavailable in
 * private windows or locked-down school browsers, so every access is guarded.
 */
const PREFIX = 'biosim:'

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value)
  } catch {
    // Ignore — the app works the same without saved preferences.
  }
}
