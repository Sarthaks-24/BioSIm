import { createElement, Suspense, type ComponentType } from 'react'
import { prerender } from 'react-dom/static'
import { describe, expect, it } from 'vitest'
import { isLoadError, lazyWithRetry } from './LoadBoundary.tsx'

describe('what counts as "this didn’t load" (FIX-C review, item 5)', () => {
  it('a file that did not arrive, in each browser’s words', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://lifepeek.vercel.app/assets/Sheets-abc.js',
      'error loading dynamically imported module: https://lifepeek.vercel.app/assets/Sheets-abc.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/Sheets-abc.css',
    ])
      expect(isLoadError(new TypeError(message)), message).toBe(true)
    const chunk = new Error('Loading chunk 7 failed.')
    chunk.name = 'ChunkLoadError'
    expect(isLoadError(chunk)).toBe(true)
  })

  it('never a bug in the part itself: that goes on to the error page', () => {
    expect(isLoadError(new TypeError("Cannot read properties of undefined (reading 'signals')"))).toBe(false)
    expect(isLoadError(new Error('boom'))).toBe(false)
    expect(isLoadError('Failed to fetch dynamically imported module')).toBe(false)
    expect(isLoadError(null)).toBe(false)
  })
})

/** What a lazy part throws when React draws it (server-side, so no page is needed). */
async function thrownBy(Part: ComponentType) {
  const errors: unknown[] = []
  try {
    await prerender(createElement(Suspense, { fallback: null }, createElement(Part)), { onError: (e) => void errors.push(e) })
  } catch (e) {
    errors.push(e)
  }
  return errors[0]
}

// Review FIX-D + WP-18, MED 2: main.tsx cancels `vite:preloadError` to reload, and the import then
// resolves to nothing. That must read as "this didn't load" (the load box), not as a bug (the
// route's error page).
describe('an import that resolved to nothing is a load failure', () => {
  const Fine = () => null

  it('lazyWithRetry: a module that resolved to nothing, or to no default, throws "Loading chunk failed" when drawn', async () => {
    for (const m of [undefined, {}, { default: undefined }]) {
      const error = await thrownBy(lazyWithRetry(() => Promise.resolve(m)).Component)
      expect(error, JSON.stringify(m)).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Loading chunk failed')
      expect(isLoadError(error), JSON.stringify(m)).toBe(true)
    }
  })

  it('lazyWithRetry: a part picked out of a module that resolved to nothing (the food search) too', async () => {
    const load = () => Promise.resolve(undefined as unknown as { FoodSearch: ComponentType<object> })
    const picked = lazyWithRetry<object>(() => load().then((m) => ({ default: m?.FoodSearch })))
    expect(isLoadError(await thrownBy(picked.Component))).toBe(true)
  })

  it('lazyWithRetry: a module that arrived draws, and a bug in it is still not a load error', async () => {
    expect(await thrownBy(lazyWithRetry(() => Promise.resolve({ default: Fine })).Component)).toBeUndefined()
    const Broken = () => {
      throw new TypeError("Cannot read properties of undefined (reading 'signals')")
    }
    expect(isLoadError(await thrownBy(lazyWithRetry(() => Promise.resolve({ default: Broken })).Component))).toBe(false)
  })
})
