import type { Plugin } from 'vite'
import type { ManifestTransform } from 'workbox-build'

export const CORE_ROOTS: string[]
export const LESSON_PACKS: Record<string, { webgl?: boolean; roots: string[] }>
export const LAZY_CACHE: string
export interface Tiers {
  core: Set<string>
  lazy: Set<string>
  packs: Record<string, { webgl: boolean; files: string[] }>
}
export function cacheTiers(manifest: Record<string, unknown>, assetFiles: string[]): Tiers
export function tiersOf(dir: string): Tiers
export function packManifest(tiers: Tiers): {
  cache: string
  entries: { id: string; tier: 'precache' | 'lazy'; webgl?: boolean; urls: string[] }[]
}
export default function cacheTiersPlugin(): Plugin & { manifestTransform: ManifestTransform }
