import type { Plugin } from 'vite'
import type { ManifestTransform } from 'workbox-build'

type ViteManifest = Record<string, { file: string; css?: string[]; assets?: string[]; imports?: string[]; isDynamicEntry?: boolean }>

export const CORE_ROOTS: string[]
export const PACK_SYSTEMS: Record<string, string[]>
export const ENGINE: string
export const THREE_D: string
export const HINDI: string
export const SIM_ROOTS: string[]
export const LESSON_PACKS: Record<string, { webgl?: boolean; roots: string[] }>
export const LAZY_CACHE: string
export const LAZY_URL: RegExp
export interface Tiers {
  core: Set<string>
  lazy: Set<string>
  packs: Record<string, { webgl: boolean; files: string[] }>
}
export function staticFiles(manifest: ViteManifest, roots: string[]): string[]
export function cacheTiers(manifest: ViteManifest, assetFiles: string[]): Tiers
export function tiersOf(dir: string): Tiers
export function packManifest(tiers: Tiers): {
  cache: string
  entries: { id: string; tier: 'precache' | 'lazy'; webgl?: boolean; urls: string[] }[]
}
export function tierProblems(tiers: Pick<Tiers, 'core' | 'lazy'>, precached: string[], exists?: (file: string) => boolean): string[]
export default function cacheTiersPlugin(): Plugin & { manifestTransform: ManifestTransform; ignoreLazyIn(list: string[]): void }
