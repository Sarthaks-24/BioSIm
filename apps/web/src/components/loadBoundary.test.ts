import { describe, expect, it } from 'vitest'
import { isLoadError } from './LoadBoundary.tsx'

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
