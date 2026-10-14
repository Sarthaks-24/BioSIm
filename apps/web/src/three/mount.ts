import type { BufferGeometry, MeshStandardMaterial, ShaderMaterial } from 'three'
import type { NutrientKind } from '@lifepeek/engine'
import { buildParticles, buildShell } from './geometry.ts'
import type { Layer3d, LayerState, Tier } from './layer.ts'
import { KIT_3D } from './kit.ts'
import { layerUniforms, outlineMaterial, shellMaterial, tissueMaterial, type LayerUniforms } from './materials.ts'

/**
 * Mount and dispose of the 3D body's parts (A-0 3D half; anatomy plan D5, §10).
 *
 * One lit layer is mounted at a time. Mounting builds (or takes from the cache) its mesh and makes
 * its materials; releasing frees what the GPU holds (geometry buffers, programs) and keeps the CPU
 * arrays, so switching back costs an upload, not a rebuild (the cavity shading alone is ~100 ms on a
 * phone). The meshes are cached per tier and layer; the built layers stay in a small LRU (at most
 * two layers and 4 MB of arrays), the base (shell, food particles) per tier for the visit.
 *
 * Whoever mounts releases: BodyCanvas gives its meshes `dispose={null}`, so fiber's own teardown
 * never disposes what this file owns, and this file disposes everything it handed out.
 */

/** At most this many built layers are kept (the one shown and the last one), and this many bytes of arrays. */
export const LRU_LAYERS = 2
export const LRU_BYTES = 4_000_000

interface Entry {
  geo: BufferGeometry
  bytes: number
  /** Bodies showing it now; a pinned entry is never evicted. */
  pins: number
}

/** The arrays of a geometry, in bytes (what the LRU counts). */
export function geometryBytes(geo: BufferGeometry): number {
  let bytes = geo.index?.array.byteLength ?? 0
  for (const a of Object.values(geo.attributes)) bytes += a.array.byteLength
  return bytes
}

/** Built layer meshes, least recently used first (a Map keeps insertion order). */
export class LayerCache {
  private entries = new Map<string, Entry>()
  /** How many times a layer was built (tests: a cached layer is not built again). */
  builds = 0

  constructor(
    private readonly maxLayers = LRU_LAYERS,
    private readonly maxBytes = LRU_BYTES,
  ) {}

  /** The layer's mesh for this tier, built if it is not here; now the most recently used. */
  get(layer: Layer3d, tier: Tier): BufferGeometry {
    const key = `${tier}:${layer.id}`
    let e = this.entries.get(key)
    if (e) this.entries.delete(key)
    else {
      const geo = layer.build(tier, KIT_3D)
      this.builds++
      e = { geo, bytes: geometryBytes(geo), pins: 0 }
    }
    this.entries.set(key, e) // most recently used last
    this.evict()
    return e.geo
  }

  /** A body shows it: never evicted until `unpin`. */
  pin(geo: BufferGeometry) {
    const e = this.find(geo)
    if (e) e.pins++
  }

  /**
   * A body no longer shows it. When none does, its GPU buffers are freed (the arrays stay, for the
   * next mount). A mesh evicted while shown is freed here too: it is in no cache any more.
   */
  unpin(geo: BufferGeometry) {
    const e = this.find(geo)
    if (e) e.pins = Math.max(0, e.pins - 1)
    if (!e || e.pins === 0) geo.dispose()
    this.evict()
  }

  private find(geo: BufferGeometry) {
    for (const e of this.entries.values()) if (e.geo === geo) return e
    return undefined
  }

  /** Drops least recently used layers past the limits; never one on screen, nor the one just asked for. */
  private evict() {
    let bytes = this.bytes()
    const newest = this.keys().at(-1)
    for (const [key, e] of this.entries) {
      if (this.entries.size <= this.maxLayers && bytes <= this.maxBytes) break
      if (e.pins > 0 || key === newest) continue
      this.entries.delete(key)
      e.geo.dispose()
      bytes -= e.bytes
    }
  }

  bytes() {
    let n = 0
    for (const e of this.entries.values()) n += e.bytes
    return n
  }

  keys() {
    return [...this.entries.keys()]
  }

  /** Geometries held here (for the leak probe). */
  geometries() {
    return [...this.entries.values()].map((e) => e.geo)
  }
}

const layers = new LayerCache()

interface Base {
  shell: BufferGeometry
  particles: Record<NutrientKind, BufferGeometry>
  /** Bodies showing it now. */
  pins: number
}
const bases = new Map<Tier, Base>()

/** The base meshes for this tier: built once, kept for the visit (≈ 0.4 MB). */
function base(tier: Tier): Base {
  let b = bases.get(tier)
  if (!b) bases.set(tier, (b = { shell: buildShell(), particles: buildParticles(), pins: 0 }))
  return b
}

/** A mounted layer: its mesh, its materials and the uniforms its `write` fills each frame. */
export interface MountedLayer {
  layer: Layer3d
  geometry: BufferGeometry
  uniforms: LayerUniforms
  /** Views of the uniform arrays, for Layer3d.write. */
  state: LayerState
  tissue: MeshStandardMaterial
  outline: ShaderMaterial
}

/**
 * Makes a layer's materials and takes its mesh from the cache (built on its first mount). Nothing
 * reaches the GPU until it is drawn. The effect that shows it calls `pinLayer`, and `releaseLayer`
 * when it goes; both are safe to repeat (React's strict mode runs effects twice).
 */
export function mountLayer(layer: Layer3d, tier: Tier): MountedLayer {
  const uniforms = layerUniforms(layer.organs.length)
  const grow = !!layer.grow
  layer.grow?.origins.forEach((o, i) => uniforms.uGrowAt.value[i]?.fromArray(o))
  return {
    layer,
    geometry: layers.get(layer, tier),
    uniforms,
    state: { state: uniforms.uState.value, fill: uniforms.uFill.value, dash: uniforms.uDash.value, flow: uniforms.uFlow.value },
    tissue: tissueMaterial(uniforms, layer.id, grow, layer.dashes ?? false),
    outline: outlineMaterial(uniforms, grow),
  }
}

export const pinLayer = (m: MountedLayer) => layers.pin(m.geometry)

/** Frees a layer's GPU side: its programs (materials) and, when no body shows it, its buffers. Its arrays stay cached. */
export function releaseLayer(m: MountedLayer) {
  m.tissue.dispose()
  m.outline.dispose()
  layers.unpin(m.geometry)
}

/** The base: the skin shell and the food particles, with the shell's material. */
export function mountBase(tier: Tier) {
  const b = base(tier)
  return { tier, shell: b.shell, particles: b.particles, shellMaterial: shellMaterial() }
}
export type MountedBase = ReturnType<typeof mountBase>

export function pinBase(m: MountedBase) {
  base(m.tier).pins++
}

/** Frees the base's GPU side when no body shows it (its arrays stay for the next body). */
export function releaseBase(m: MountedBase) {
  m.shellMaterial.dispose()
  const b = base(m.tier)
  b.pins = Math.max(0, b.pins - 1)
  if (b.pins > 0) return
  b.shell.dispose()
  for (const g of Object.values(b.particles)) g.dispose()
}

/**
 * What the leak probe reads (e2e, ?debug=fps): the cached layers, their bytes, and how many of the
 * geometries this file owns are still known to a renderer (three adds a `dispose` listener to each
 * geometry it uploads, and removes it when the geometry is disposed). With no body on the page it
 * must be 0, or an old renderer (and its context) is kept alive by our cache.
 */
export function mountStats() {
  const owned = [...layers.geometries(), ...[...bases.values()].flatMap((b) => [b.shell, ...Object.values(b.particles)])]
  const listened = owned.filter((g) => {
    const listeners = (g as unknown as { _listeners?: Record<string, unknown[]> })._listeners
    return (listeners?.dispose?.length ?? 0) > 0
  }).length
  return { layers: layers.keys(), bytes: layers.bytes(), builds: layers.builds, uploaded: listened }
}
