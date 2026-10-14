import type { RunResult } from '@lifepeek/engine'
import type { Sheet } from '../../state/sheet.ts'
import type { GraphSlotDef, SystemUi } from '../../systems/registry.ts'
import StripTable from '../graphs/StripTable.tsx'
import KeysHelp from './KeysHelp.tsx'
import MomentList from './MomentList.tsx'
import { addEnglish } from '../../i18n/index.ts'
import keysText from 'virtual:lifepeek-en/keys'
import tableText from 'virtual:lifepeek-en/table'
import mealSheetText from 'virtual:lifepeek-en/mealSheet'

// The sheets' own English comes with them (the stage keeps only the buttons' names).
addEnglish(keysText, tableText, mealSheetText)

export { default as FoodSearch } from './FoodSearch.tsx'

/**
 * The stage's sheets in one file, downloaded together the first time one is opened: the table,
 * the settings and a timeline target's key moments (pages/Simulator.tsx), and the food search
 * (AddFoodSheet). One small chunk of things that are not part of the first paint (size budget); as
 * separate chunks, the bundler would split the code they share with the stage into many small
 * files that every visitor downloads.
 */
export default function Sheets({
  sheet,
  run,
  kept,
  slots,
  ui,
}: {
  sheet: NonNullable<Sheet>
  run: RunResult
  kept: RunResult | null
  slots: readonly GraphSlotDef[]
  /** The lit system's words and moments, from the stage: importing them here would split the stage's code. */
  ui: SystemUi
}) {
  if (sheet.kind === 'table') return <StripTable run={run} kept={kept} slots={slots} slot={sheet.slot} ui={ui} />
  return sheet.kind === 'moments' ? <MomentList moments={sheet.moments} /> : <KeysHelp />
}
