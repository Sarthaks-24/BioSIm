import { describe, expect, it } from 'vitest'
import { SOURCES } from '@lifepeek/engine'
import { REFERENCES } from './references.ts'

describe('Science page references', () => {
  it('list every registered source under its ID, so every "How we know" link has its anchor', () => {
    const ids = REFERENCES.map((r) => r.id)
    for (const id of Object.keys(SOURCES)) expect(ids, id).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
