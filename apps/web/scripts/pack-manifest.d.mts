export type Tier = 'precache' | 'lazy'
export interface PackManifest {
  entries: Record<string, { tier: Tier; files: string[] }>
  precache: string[]
  lazy: string[]
}
type ViteManifest = Record<string, { file: string; css?: string[]; imports?: string[]; isDynamicEntry?: boolean }>

export const PACK_SYSTEMS: Record<string, string[]>
export const ENGINE: string
export const THREE_D: string
export const ACTIVITY_SHEET: string
export const BOUT_MARKS: string
export const HINDI: string
export const SIM_ROOTS: string[]
export function staticFiles(manifest: ViteManifest, roots: string[]): string[]
export function packManifest(manifest: ViteManifest): PackManifest
export function tierProblems(packs: PackManifest, precached: string[], exists?: (url: string) => boolean): string[]
