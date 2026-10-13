/**
 * The stated person (binding 8): who the run is about. UI word for humans: "person"; on-screen tag
 * for 'adult-ref': "Typical adult" (council SHOULD 12; was "Adult model"), and "How we know" says it is the ICMR-NIN 2020 reference man.
 * Only the energy signals read the profile in v2.0; digestion and glucose use adult data for everyone.
 * Plan: plans/v2 04-CATALOG-DRAFT §4.
 */
import type { OrganismId, ProfileId } from './organism.ts'
import type { SourceId } from './sources.ts'

export interface ProfileDef {
  id: ProfileId
  organism: OrganismId
  sex: 'male' | 'female'
  /** Age range the profile stands for, in years (inclusive). */
  ageY: readonly [number, number]
  weightKg: number
  /** Resting (basal) energy use, kcal per day. Drives energy.usedRate. */
  restingKcalPerDay: number
  sourceIds: readonly SourceId[]
  /** Digestion, absorption and GI data are adult data in every profile; say so on screen for non-adults. */
  digestionDataAreAdult: true
  /** `profiles.${id}` (.tag, .desc). */
  i18nKey: string
}

/**
 * Schofield BMR equation for men aged 18–30 y, kcal/day from body weight in kg
 * (FAO/WHO/UNU 2004, §5.2, Table 5.2: "15.057kg + 692.2").
 */
export const schofieldMale18to30KcalPerDay = (weightKg: number): number => 15.057 * weightKg + 692.2

/**
 * ICMR-NIN 2020 lowers the FAO/WHO/UNU BMR by 10 % for Indian adults (5 % in 2010, a further 5 % in
 * 2020), because the equations overestimate Indian BMR by 10–12 % (ICMR-NIN 2020, brief note).
 */
export const ICMR_ADULT_BMR_FACTOR = 0.9

export const PROFILES: { readonly [P in ProfileId]: ProfileDef } = {
  // ICMR-NIN 2020 reference adult man: 19–39 y, 65 kg. At rest: 1503.8 kcal/d ≈ 62.7 kcal/h.
  'adult-ref': {
    id: 'adult-ref',
    organism: 'human',
    sex: 'male',
    ageY: [19, 39],
    weightKg: 65,
    restingKcalPerDay: schofieldMale18to30KcalPerDay(65) * ICMR_ADULT_BMR_FACTOR,
    sourceIds: ['faowhounu2004', 'icmr-nin2020'],
    digestionDataAreAdult: true,
    i18nKey: 'profiles.adult-ref',
  },
}

export const isProfileId = (id: string): id is ProfileId => Object.hasOwn(PROFILES, id)
