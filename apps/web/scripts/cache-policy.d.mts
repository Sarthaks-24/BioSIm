import type { GenerateSWOptions } from 'workbox-build'
import type cacheTiersPlugin from './cache-tiers.mjs'

export function workboxPolicy(o: { hindi: boolean; tiers: ReturnType<typeof cacheTiersPlugin> }): Partial<GenerateSWOptions>
