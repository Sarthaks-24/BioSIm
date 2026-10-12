/**
 * O-0: organism-ready, human-only. Every ID in the catalog is organism-neutral; the organism and
 * the stated person (profile) are separate inputs. Only the human exists in v2.0.
 * WP-05 adds `HumanInput` / `SimInput` here; WP-06 adds `core/profile.ts` (the profile data).
 */

/** Later: | 'plant' | 'amoeba' | 'cow' | 'fish' … (plan-organisms). */
export type OrganismId = 'human'
export const DEFAULT_ORGANISM: OrganismId = 'human'

/** The stated person, scoped to the organism. UI word for humans: "person". Reserved next: 'teen-ref'. */
export type ProfileId = 'adult-ref'
export const DEFAULT_PROFILE: { readonly [O in OrganismId]: ProfileId } = { human: 'adult-ref' }
