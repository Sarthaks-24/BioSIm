/**
 * O-0: organism-ready, human-only. Every ID in the catalog is organism-neutral; the organism and
 * the stated person (profile) are separate inputs. Only the human exists in v2.0.
 * The profile data live in `core/profile.ts`. Plan: plans/v2 plan-organisms.md.
 */
import type { MealItem } from '../meal.ts'
import type { ActivityBout } from './activity.ts'
import type { ActiveSignalId } from './catalog.ts'
import type { ModelModule } from './module.ts'

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

/** What one human run needs (result.ts RunInput). The foods are looked up by id (`simulate(input, { lookup })`). */
export interface HumanInput {
  /** Absent ⇒ human, forever. */
  organism?: 'human'
  items: MealItem[]
  /** Absent ⇒ DEFAULT_PROFILE.human. Sets energy.usedRate (core/profile.ts). */
  profile?: ProfileId
  /** Activity bouts (core/activity.ts). Absent or empty ⇒ resting all the time: the same run as before E-3b. */
  activity?: readonly ActivityBout[]
}
/**
 * One organism's model: its version, clock, parameter set and modules. `simulate()` puts `params` into
 * its context and passes it to every module; modules never read a global parameter object.
 */
export interface OrganismModel<P extends object = object> {
  id: OrganismId
  /** The `v` in that organism's share links (human = MODEL_VERSION). */
  modelVersion: number
  horizonMin: number
  stepMin: number
  params: Readonly<P>
  /** What one run runs, in the frozen order (core/module.ts MODULE_ORDER). */
  modules: readonly ModelModule<P>[]
  /** = PROVIDES[id]: every signal the modules provide. */
  provides: readonly ActiveSignalId[]
}
