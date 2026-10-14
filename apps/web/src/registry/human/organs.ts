import type * as Base from '../../anatomy/human/base.ts'
import type * as Digestion from '../../anatomy/human/digestion.ts'
import type * as Lymph from '../../anatomy/human/lymph.ts'
import type { OrganDef } from '../types.ts'

/** The exports of the anatomy files (anatomy/human/), so a typo in `anatomyRef` fails the typecheck. */
type HumanAnatomyRef = keyof typeof Base | keyof typeof Digestion | keyof typeof Lymph

/** Names reuse the v1 keys: the gut stages under `stages.<id>.name`, the other organs under `anatomy.<id>`. */
export const HUMAN_ORGANS: readonly OrganDef<HumanAnatomyRef>[] = [
  { id: 'mouth', i18nKey: 'stages.mouth.name', anatomyRef: 'MOUTH' },
  { id: 'esophagus', i18nKey: 'stages.esophagus.name', anatomyRef: 'ESOPHAGUS' },
  { id: 'stomach', i18nKey: 'stages.stomach.name', anatomyRef: 'STOMACH', drives: { fill: 'gut.stomach.contentG' } },
  { id: 'smallIntestine', i18nKey: 'stages.smallIntestine.name', anatomyRef: 'SMALL_INTESTINE', drives: { fill: 'gut.small.contentG' } },
  { id: 'largeIntestine', i18nKey: 'stages.largeIntestine.name', anatomyRef: 'LARGE_INTESTINE', drives: { fill: 'gut.colon.contentG' } },
  { id: 'liver', i18nKey: 'anatomy.liver', anatomyRef: 'LIVER' },
  { id: 'pancreas', i18nKey: 'anatomy.pancreas', anatomyRef: 'PANCREAS' },
]
