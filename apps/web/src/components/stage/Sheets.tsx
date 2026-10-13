import type { Simulation } from '@lifepeek/engine'
import type { Sheet } from '../../state/sheet.ts'
import type { Slot } from './GraphColumn.tsx'
import StripTable from '../graphs/StripTable.tsx'
import KeysHelp from './KeysHelp.tsx'

export { default as FoodSearch } from './FoodSearch.tsx'

/**
 * The stage's sheets in one file, downloaded together the first time one is opened: the table and
 * the keys (Stage.tsx), and the food search (AddFoodSheet). One small chunk of things that are not
 * part of the first paint (size budget); as separate chunks, the bundler would split the code they
 * share with the stage into many small files that every visitor downloads.
 */
export default function Sheets({
  sheet,
  run,
  kept,
  slots,
}: {
  sheet: NonNullable<Sheet>
  run: Simulation
  kept: Simulation | null
  slots: readonly Slot[]
}) {
  return sheet.kind === 'table' ? <StripTable run={run} kept={kept} slots={slots} slot={sheet.slot} /> : <KeysHelp />
}
