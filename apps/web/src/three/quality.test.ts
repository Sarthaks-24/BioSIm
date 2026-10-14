import { describe, expect, it } from 'vitest'
import { geometryTier, quality } from './quality.ts'

describe('3D quality on cheap phones', () => {
  it('caps the pixel ratio at 1.5 with anti-aliasing by default', () => {
    expect(quality({})).toEqual({ dpr: 1.5, antialias: true })
    expect(quality({ deviceMemory: 8 })).toEqual({ dpr: 1.5, antialias: true })
  })

  it('drops to 1.25 and no multisampling on a 2 GB phone', () => {
    expect(quality({ deviceMemory: 2 })).toEqual({ dpr: 1.25, antialias: false })
    expect(quality({ deviceMemory: 1 })).toEqual({ dpr: 1.25, antialias: false })
  })
})

describe('3D geometry tier', () => {
  it('is low on a 2 GB phone, high otherwise', () => {
    expect(geometryTier({})).toBe('high')
    expect(geometryTier({ deviceMemory: 4 })).toBe('high')
    expect(geometryTier({ deviceMemory: 2 })).toBe('low')
  })
})
