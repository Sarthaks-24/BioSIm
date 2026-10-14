import { describe, expect, it } from 'vitest'
import { BufferGeometry, Float32BufferAttribute, type Material } from 'three'
import { LayerCache, LRU_BYTES, geometryBytes, mountLayer, pinLayer, releaseLayer } from './mount.ts'
import { KIT_3D } from './kit.ts'
import { LAYER_ATTRIBUTES, type Layer3d } from './layer.ts'
import { DIGESTION_3D } from './layers/digestion.ts'

/** A stand-in layer whose mesh is `vertices` points (A-0 3D: the cache is the same for every layer). */
function fakeLayer(id: string, vertices = 10): Layer3d {
  return {
    id,
    organs: ['a', 'b'],
    build: () => {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertices * 3), 3))
      return g
    },
    write: () => {},
  }
}

/** What a renderer does when it uploads a geometry: listen for its dispose (three's WebGLGeometries). */
function upload(geo: BufferGeometry) {
  let freed = 0
  const listener = () => {
    freed++
    geo.removeEventListener('dispose', listener)
  }
  geo.addEventListener('dispose', listener)
  return () => freed
}

describe('3D layer cache (anatomy plan §10)', () => {
  it('builds a layer once; switching away and back takes it from the cache', () => {
    const cache = new LayerCache()
    const a = fakeLayer('a')
    const b = fakeLayer('b')
    const geo = cache.get(a, 'high')
    for (let i = 0; i < 20; i++) {
      cache.get(i % 2 ? a : b, 'high')
    }
    expect(cache.get(a, 'high')).toBe(geo)
    expect(cache.builds).toBe(2)
  })

  it('keeps tiers apart', () => {
    const cache = new LayerCache()
    const a = fakeLayer('a')
    expect(cache.get(a, 'low')).not.toBe(cache.get(a, 'high'))
    expect(cache.keys()).toEqual(['low:a', 'high:a'])
  })

  it('keeps at most two layers, dropping the least recently used', () => {
    const cache = new LayerCache()
    const [a, b, c] = ['a', 'b', 'c'].map((id) => fakeLayer(id))
    cache.get(a!, 'high')
    cache.get(b!, 'high')
    cache.get(a!, 'high')
    cache.get(c!, 'high')
    expect(cache.keys()).toEqual(['high:a', 'high:c'])
  })

  it('keeps at most 4 MB of arrays, but never drops the layer on screen', () => {
    const cache = new LayerCache(2, 1000)
    const big = fakeLayer('big', 100) // 1200 bytes
    const small = fakeLayer('small')
    const shown = cache.get(big, 'high')
    cache.pin(shown)
    cache.get(small, 'high')
    expect(cache.keys()).toEqual(['high:big', 'high:small'])
    cache.unpin(shown)
    expect(cache.keys()).toEqual(['high:small'])
    expect(LRU_BYTES).toBe(4_000_000)
  })

  it('frees the GPU side when no body shows it, and keeps the arrays', () => {
    const cache = new LayerCache()
    const geo = cache.get(fakeLayer('a'), 'high')
    cache.pin(geo)
    cache.pin(geo) // two bodies
    const freed = upload(geo)
    cache.unpin(geo)
    expect(freed()).toBe(0)
    cache.unpin(geo)
    expect(freed()).toBe(1)
    expect(geo.getAttribute('position').array.length).toBe(30)
  })

  it('an evicted layer is disposed', () => {
    const cache = new LayerCache()
    const geo = cache.get(fakeLayer('a'), 'high')
    const freed = upload(geo)
    cache.get(fakeLayer('b'), 'high')
    cache.get(fakeLayer('c'), 'high')
    expect(freed()).toBe(1)
  })
})

describe('digestion layer (A-0 3D: shared attributes, uFill[N])', () => {
  const geo = DIGESTION_3D.build('high', KIT_3D)

  it('every vertex has the shared attribute set, `along` kept', () => {
    expect(Object.keys(geo.attributes).sort()).toEqual([...LAYER_ATTRIBUTES].sort())
    const n = geo.getAttribute('position').count
    for (const name of LAYER_ATTRIBUTES) expect(geo.getAttribute(name).count).toBe(n)
    const along = geo.getAttribute('along').array as Float32Array
    expect(Math.max(...along)).toBe(1)
    expect(along.some((u) => u > 0 && u < 1)).toBe(true)
    // No chamber or posing segment in the gut.
    expect((geo.getAttribute('chamber').array as Float32Array).every((v) => v === 0)).toBe(true)
    expect((geo.getAttribute('seg').array as Float32Array).every((v) => v === 0)).toBe(true)
  })

  it('fits the LRU twice over (two layers ≤ 4 MB)', () => {
    expect(geometryBytes(geo)).toBeLessThan(LRU_BYTES / 2)
  })

  it('has one uFill and one uState slot per organ, and its own program key', () => {
    const m = mountLayer(DIGESTION_3D, 'high')
    expect(m.uniforms.uFill.value).toHaveLength(DIGESTION_3D.organs.length)
    expect(m.uniforms.uState.value).toHaveLength(DIGESTION_3D.organs.length)
    expect(m.state.fill).toBe(m.uniforms.uFill.value)
    const key = (mat: Material) => mat.customProgramCacheKey()
    expect(key(m.tissue)).toBe(`lifepeek-tissue:digestion:${DIGESTION_3D.organs.length}`)
    expect(key(mountLayer(fakeLayer('lungs'), 'high').tissue)).not.toBe(key(m.tissue))
    pinLayer(m)
    releaseLayer(m)
  })
})
