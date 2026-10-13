import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

/** A fresh prefs module (its memory is per page), with `window.localStorage` as given. */
async function prefsWith(localStorage: () => Storage) {
  vi.stubGlobal('window', {
    get localStorage() {
      return localStorage()
    },
  })
  return import('./prefs.ts')
}

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  }
}

describe('prefs', () => {
  it('saves to localStorage under the lifepeek: prefix', async () => {
    const storage = memoryStorage()
    const { readPref, writePref, clearPref } = await prefsWith(() => storage)
    expect(readPref('lang')).toBe(null)
    writePref('lang', 'en')
    expect(storage.getItem('lifepeek:lang')).toBe('en')
    expect(readPref('lang')).toBe('en')
    clearPref('lang')
    expect(storage.getItem('lifepeek:lang')).toBe(null)
    expect(readPref('lang')).toBe(null)
  })

  it('reads what an earlier visit saved', async () => {
    const storage = memoryStorage()
    storage.setItem('lifepeek:projector', '1')
    const { readPref } = await prefsWith(() => storage)
    expect(readPref('projector')).toBe('1')
  })

  it('with storage blocked (every access throws), a choice still holds for the visit', async () => {
    const { readPref, writePref, clearPref } = await prefsWith(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    expect(readPref('projector')).toBe(null)
    writePref('projector', '1')
    expect(readPref('projector')).toBe('1')
    clearPref('projector')
    expect(readPref('projector')).toBe(null)
  })

  it('a full storage (setItem throws) keeps the new choice, not the old saved one', async () => {
    const storage = memoryStorage()
    storage.setItem('lifepeek:lang', 'en')
    const full = {
      ...storage,
      getItem: storage.getItem,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as Storage
    const { readPref, writePref } = await prefsWith(() => full)
    writePref('lang', 'hi')
    expect(readPref('lang')).toBe('hi')
  })
})
