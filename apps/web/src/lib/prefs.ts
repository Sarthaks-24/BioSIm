/**
 * Per-device conveniences only (language, projector mode, reduce motion). Storage can be unavailable in
 * private windows or locked-down school browsers, so every access is guarded. A choice made while
 * storage is blocked still holds for the rest of the visit: it is kept in memory (it never reaches
 * the next visit, which is all a blocked browser allows).
 */
const PREFIX = 'lifepeek:'

/** This visit's choices (null = cleared), read before storage so a blocked write is not lost. */
const session = new Map<string, string | null>()

export function readPref(key: string): string | null {
  if (session.has(key)) return session.get(key)!
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  session.set(key, value)
  try {
    window.localStorage.setItem(PREFIX + key, value)
  } catch {
    // Ignore — the app works the same without saved preferences.
  }
}

export function clearPref(key: string): void {
  session.set(key, null)
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore, as above.
  }
}
