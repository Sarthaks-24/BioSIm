/**
 * O-0: organism-ready, human-only. Every ID in the catalog is organism-neutral; the organism and
 * the stated person (profile) are separate inputs. Only the human exists in v2.0.
 * The profile data live in `core/profile.ts`. Plan: plans/v2 plan-organisms.md.
 */
import type { MealItem } from '../meal.ts'
import type { ActiveSignalId } from './catalog.ts'

/** Later: | 'plant' | 'amoeba' | 'cow' | 'fish' … (plan-organisms). */
export type OrganismId = 'human'
export const DEFAULT_ORGANISM: OrganismId = 'human'
export const ORGANISM_IDS: readonly OrganismId[] = ['human']
export const isOrganismId = (id: string): id is OrganismId => (ORGANISM_IDS as readonly string[]).includes(id)

/** The stated person, scoped to the organism. UI word for humans: "person". Reserved next: 'teen-ref'. */
export type ProfileId = 'adult-ref'
export const DEFAULT_PROFILE: { readonly [O in OrganismId]: ProfileId } = { human: 'adult-ref' }
/** Which profiles each organism offers. A link's `who` is valid only if it is listed for its organism. */
export const ORGANISM_PROFILES: { readonly [O in OrganismId]: readonly ProfileId[] } = { human: ['adult-ref'] }

/** What one human run needs. The foods are looked up by id (`simulate(input, { lookup })`). */
export interface HumanInput {
  /** Absent ⇒ human, forever. */
  organism?: 'human'
  items: MealItem[]
  /** Absent ⇒ DEFAULT_PROFILE.human. Sets energy.usedRate (core/profile.ts). */
  profile?: ProfileId
}
/** Later: | { organism: 'plant'; conditions: {...}; profile: 'leaf-ref' }. */
export type SimInput = HumanInput

/**
 * One organism's model: its version, clock and parameter set. `simulate()` puts `params` into
 * its context and passes it to every module; modules never read a global parameter object.
 */
export interface OrganismModel<P extends object = object> {
  id: OrganismId
  /** The `v` in that organism's share links (human = MODEL_VERSION). */
  modelVersion: number
  horizonMin: number
  stepMin: number
  params: Readonly<P>
  /** = PROVIDES[id]. */
  provides: readonly ActiveSignalId[]
}
