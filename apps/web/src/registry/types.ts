import type { ComponentType } from 'react'
import type { ActiveSignalId, OrganismId, ProfileId, RunResult } from '@lifepeek/engine'
import type { SystemDef, SystemId } from '../systems/registry.ts'

/**
 * The registry: organisms, their systems and organs as data (ROADMAP A5 + O-0, plans/v2
 * plan-organisms §1 and plan-architecture §4.6). The screen reads these lists instead of
 * hard-wiring digestion, so adding a system later is one `SystemDef` entry plus its flat and
 * 3D layer components; adding an organism is one more folder next to `human/`.
 * Grouped by organism: system and organ IDs may repeat across organisms, and their names are
 * global i18n keys. The systems themselves (SystemId, SystemDef) are in systems/registry.ts (W-1).
 * `registry.test.ts` checks every reference; `i18n.test.ts` marks the keys used.
 */

/** A layer's props: the run it draws. Settled when the first layer ships. */
export interface LayerProps {
  sim: RunResult
  /** Accessible description of what the picture shows. */
  label: string
}
/** A layer drawn over the base body. */
export type LayerComponent = ComponentType<LayerProps>
/** Dynamic import, so the registry stays data-only and every drawing is its own chunk. */
export type Loader<C> = () => Promise<{ default: C }>

/** NCERT "Life Processes" groups (and movement, protection, reproduction: architecture §5.1). Group the picker's rows. */
export type LifeProcess = 'nutrition' | 'respiration' | 'transport' | 'excretion' | 'control' | 'movement' | 'protection' | 'reproduction'

export type { SystemDef, SystemId }

/** Organ IDs are organism-neutral, like signal IDs (a cow's stomach is still 'stomach'). */
export type OrganId = 'mouth' | 'esophagus' | 'stomach' | 'smallIntestine' | 'largeIntestine' | 'liver' | 'pancreas'

/** Reserved names for the first "look inside" views (bundle D). No entries in v2.0. */
export type InsideViewId = 'villus' | 'stomachWall' | 'liverLobule'

type Vec3 = readonly [number, number, number]
/** Where the 3D camera eases to when the system's layer is on (scene units, see anatomy/human.ts). */
export interface CameraPreset {
  position: Vec3
  target: Vec3
}

export interface OrganismDef {
  id: OrganismId
  /** `organisms.${id}` (.name). */
  i18nKey: string
  kind: 'animal' | 'plant' | 'singleCell'
  /** Which picker the screen shows: a meal (animals) or growing conditions (plants, later). */
  inputKind: 'meal' | 'conditions'
  /** Stated people this organism offers; each must be in the engine's ORGANISM_PROFILES. The first is the default. */
  profiles: readonly ProfileId[]
  defaultSystem: SystemId
  /** Per-organism display hints (a cow's blood sugar needs another axis). The graphs read `displayRange`. */
  signalOverrides: Partial<Record<ActiveSignalId, { displayRange?: readonly [number, number] }>>
}

export interface OrganDef<Ref extends string = string> {
  id: OrganId
  /** The full key of the organ's name (reuses `stages.<id>.name` or `anatomy.<id>`). */
  i18nKey: string
  /** The export of the organism's anatomy file (`anatomy/human.ts`) that holds its curve or point. */
  anatomyRef: Ref
  /** Visual channel ← signal. The stomach's fill follows how much food is in it. */
  drives?: Partial<Record<'fill' | 'glow' | 'pulse', ActiveSignalId>>
}

/** A zoomed-in view of one organ (bundle D). Shared across organisms: a villus is a villus. */
export interface InsideViewDef {
  id: InsideViewId
  organ: OrganId
  i18nKey: string
  scaleHintKey: string
  /** Inputs, resolved by the shell; the view never reads the engine directly. */
  signals: readonly ActiveSignalId[]
  load: Loader<ComponentType<{ simMin: number; reduced: boolean }>>
}

/** Everything the screen needs to know about one organism. */
export interface OrganismRegistry {
  organism: OrganismDef
  systems: readonly SystemDef[]
  organs: readonly OrganDef[]
}
