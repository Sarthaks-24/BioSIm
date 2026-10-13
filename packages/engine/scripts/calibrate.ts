/**
 * Prints the model's key outputs next to the published targets they are calibrated against.
 * Run after changing params.ts:  npm run calibrate -w @lifepeek/engine
 *
 * A model version change is reviewed as a diff (MODEL D13 ii):
 *   npm run calibrate -w @lifepeek/engine -- --snapshot scripts/calibration/v3.json
 *       key outputs of every Home preset, lesson and calibration meal, as JSON;
 *   npm run calibrate -w @lifepeek/engine -- --diff scripts/calibration/v2.json scripts/calibration/v3.json
 *       a Markdown table, old vs new, for the reviewer (docs/MODEL-V3-DIFF.md is its output);
 *   npm run calibrate -w @lifepeek/engine -- --pins
 *       the PINNED block for test/regression.test.ts, from this model.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MODEL_VERSION,
  buildMeal,
  decodeMeal,
  indexAt,
  parseFood,
  stomachFraction,
  type ActiveSignalId,
  type EventId,
  type RunResult,
} from '../src/index.ts'
import { simulate } from '../src/run.ts'
import { lookup as fixtureLookup } from '../test/fixtures.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))

const pct = (sim: RunResult, t: number) => stomachFraction(sim, indexAt(sim, t + sim.meal.eatingMin)) * 100
const glucose = (sim: RunResult) => sim.signals.get('blood.glucose')!.values
const iauc = (sim: RunResult) => {
  let a = 0
  for (let t = 0; t <= 120; t++) a += Math.max(0, glucose(sim)[t]! - 90)
  return a
}
const last = (sim: RunResult, id: ActiveSignalId) => {
  const v = sim.signals.get(id)!.values
  return v[v.length - 1]!
}
const at = (sim: RunResult, id: EventId) => sim.moments.get(id)?.atMin ?? null

/** The meals a model change is reviewed on: the calibration rows, then every meal on Home and Teach. */
const CALIBRATION: [meal: string, target: string][] = [
  ['water-test:1', 'water t½ ~16 min (Ziessman 2009)'],
  ['glucose-50:1', '50 g glucose: peak +30–60 at 30–60 min; 2 h near baseline (FAO/WHO 1998)'],
  ['standard-meal:1', 'Abell 2008: 1 h 37–90 %, 2 h 30–60 %, 4 h ≤10 %'],
  ['bread-50:1', 'GI 75 → iAUC ratio 0.75'],
  ['fatty-meal:1', 'high-fat meal: stomach ≥6 h (OpenStax §23.4)'],
  ['cola:1', 'home page: cola ~half out in ~30 min'],
  ['cheeseburger:1,fries:1', 'home page: burger + fries takes hours'],
  ['cheeseburger:2,fries:2', 'near the 1500 kcal cap'],
]
/** apps/web/src/lib/presets.ts: PRESETS (Home) and LESSONS (Teach), each meal and kept meal. */
const PRESET_MEALS = [
  'cola:1',
  'cheeseburger:1,fries:1',
  'roti:1,dal:1',
  'white-rice:1',
  'apple:1',
  'orange-juice:1',
  'water:1',
  'milk:1',
  'cola:4',
]
const REVIEW_MEALS = [...new Set([...PRESET_MEALS, ...CALIBRATION.map(([m]) => m)])]

const r1 = (x: number) => Math.round(x * 10) / 10

/** The key outputs of one meal, rounded for reading (not for pinning: --pins does that). */
function keyOutputs(sim: RunResult, ref: number) {
  const e = sim.events
  const peak = e.glucosePeak
  return {
    kcal: Math.round(sim.meal.total.energyKcal),
    stomachHalfMin: e.stomachHalfEmptyMin,
    stomach90Min: e.stomach90EmptyMin,
    stomachLeftPct1h: r1(pct(sim, 60)),
    stomachLeftPct2h: r1(pct(sim, 120)),
    stomachLeftPct4h: r1(pct(sim, 240)),
    glucosePeakRise: peak ? r1(peak.riseMgDl.typical) : null,
    glucosePeakMin: peak ? peak.timeMin : null,
    glucoseBackMin: at(sim, 'event.glucoseBackToBase'),
    glucoseIaucVsGlucose50: Math.round((iauc(sim) / ref) * 100) / 100,
    mostlyAbsorbedMin: at(sim, 'event.mostlyAbsorbed'),
    firstLeftoversMin: at(sim, 'event.firstLeftovers'),
    absorbedCarbsG48h: r1(last(sim, 'gut.absorbed.carbsG')),
    absorbedProteinG48h: r1(last(sim, 'gut.absorbed.proteinG')),
    absorbedFatG48h: r1(last(sim, 'gut.absorbed.fatG')),
    absorbedWaterG48h: r1(last(sim, 'gut.absorbed.waterG')),
    leftBodyG48h: r1(last(sim, 'gut.leftBodyG')),
    energyInKcal4h: r1(sim.signals.get('energy.inTotal')!.values[240]!),
    energyInKcal48h: r1(last(sim, 'energy.inTotal')),
  }
}
type Snapshot = { modelVersion: number; meals: Record<string, ReturnType<typeof keyOutputs>> }

function snapshot(): Snapshot {
  const ref = iauc(run('glucose-50:1'))
  return { modelVersion: MODEL_VERSION, meals: Object.fromEntries(REVIEW_MEALS.map((m) => [m, keyOutputs(run(m), ref)])) }
}

const LABELS: Record<keyof ReturnType<typeof keyOutputs>, string> = {
  kcal: 'kcal eaten',
  stomachHalfMin: 'stomach half empty (min)',
  stomach90Min: 'stomach 90 % empty (min)',
  stomachLeftPct1h: 'stomach left at 1 h (%)',
  stomachLeftPct2h: 'stomach left at 2 h (%)',
  stomachLeftPct4h: 'stomach left at 4 h (%)',
  glucosePeakRise: 'glucose peak rise (mg/dL)',
  glucosePeakMin: 'glucose peak (min)',
  glucoseBackMin: 'glucose back to base (min)',
  glucoseIaucVsGlucose50: 'glucose 2 h area vs 50 g glucose',
  mostlyAbsorbedMin: 'mostly absorbed (min)',
  firstLeftoversMin: 'first leftovers in colon (min)',
  absorbedCarbsG48h: 'carbs absorbed by 48 h (g)',
  absorbedProteinG48h: 'protein absorbed by 48 h (g)',
  absorbedFatG48h: 'fat absorbed by 48 h (g)',
  absorbedWaterG48h: 'water absorbed by 48 h (g)',
  leftBodyG48h: 'left the body by 48 h (g)',
  energyInKcal4h: 'energy in by 4 h (kcal)',
  energyInKcal48h: 'energy in by 48 h (kcal)',
}

function diff(oldSnap: Snapshot, newSnap: Snapshot): string {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v))
  const lines = [
    `# Model version ${oldSnap.modelVersion} → ${newSnap.modelVersion}: key outputs, old vs new`,
    '',
    'Generated by `npm run calibrate -w @lifepeek/engine -- --diff …` (MODEL D13 ii). Only rows that',
    'changed are listed; Δ = new − old. Meals: every meal and kept meal on Home and Teach',
    '(apps/web/src/lib/presets.ts), then the calibration meals (packages/engine/test/fixtures.ts).',
    '',
  ]
  // The largest change of each output over all meals, for a quick read before the tables.
  const biggest: string[] = []
  for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    let best: { meal: string; d: number; x: number; y: number } | null = null
    for (const [meal, b] of Object.entries(newSnap.meals)) {
      const x = oldSnap.meals[meal]?.[key]
      const y = b[key]
      if (typeof x !== 'number' || typeof y !== 'number' || x === y) continue
      if (!best || Math.abs(y - x) > Math.abs(best.d)) best = { meal, d: y - x, x, y }
    }
    if (best) biggest.push(`| ${LABELS[key]} | ${best.meal} | ${best.x} → ${best.y} |`)
  }
  lines.push('## Biggest change of each output', '')
  if (!biggest.length) lines.push('Nothing changed.', '')
  else lines.push('| output | meal | old → new |', '|---|---|---|', ...biggest, '')
  lines.push('Outputs not listed did not change for any meal.', '')
  for (const meal of Object.keys(newSnap.meals)) {
    const a = oldSnap.meals[meal]
    const b = newSnap.meals[meal]!
    const rows: string[] = []
    for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
      const x = a?.[key] ?? null
      const y = b[key]
      if (x === y) continue
      const d = typeof x === 'number' && typeof y === 'number' ? r1(y - x) : null
      rows.push(`| ${LABELS[key]} | ${fmt(x)} | ${fmt(y)} | ${d === null ? '' : d > 0 ? `+${d}` : d} |`)
    }
    lines.push(`## ${meal}`, '')
    if (!rows.length) lines.push('No change.', '')
    else lines.push('| output | old | new | Δ |', '|---|---:|---:|---:|', ...rows, '')
  }
  return lines.join('\n')
}

/** The regression pin block (test/regression.test.ts): values at 30/60/120/240 min and every moment. */
function pins(): string {
  const PIN_MEALS = ['cola:1', 'cheeseburger:1,fries:1', 'roti:1,dal:1', 'water:1']
  const SIGNALS: ActiveSignalId[] = [
    'gut.stomach.contentG',
    'gut.stomach.liquidG',
    'gut.stomach.solidG',
    'gut.small.contentG',
    'gut.colon.contentG',
    'gut.absorbed.carbsG',
    'gut.absorbed.proteinG',
    'gut.absorbed.fatG',
    'gut.absorbed.waterG',
    'gut.absorbed.fibreG',
    'gut.leftBodyG',
    'blood.glucose',
  ]
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const out = ['const PINNED: Record<string, Pin> = {']
  for (const meal of PIN_MEALS) {
    const sim = run(meal)
    out.push(`  '${meal}': {`, '    moments: {')
    for (const [id, p] of sim.moments) {
      const v = p.atMin === null ? 'null' : p.low !== undefined ? `[${r3(p.low)}, ${r3(p.atMin)}, ${r3(p.high!)}]` : String(r3(p.atMin))
      out.push(`      '${id}': ${v},`)
    }
    out.push('    },')
    for (const t of [30, 60, 120, 240]) {
      out.push(`    ${t}: {`)
      for (const id of SIGNALS) out.push(`      '${id}': ${r3(sim.signals.get(id)!.values[t / sim.stepMin]!)},`)
      out.push('    },')
    }
    out.push('  },')
  }
  out.push('}')
  return out.join('\n')
}

const args = process.argv.slice(2)
if (args[0] === '--snapshot') {
  const file = resolve(process.cwd(), args[1] ?? `scripts/calibration/v${MODEL_VERSION}.json`)
  writeFileSync(file, `${JSON.stringify(snapshot(), null, 2)}\n`)
  console.log(`wrote ${file}`)
} else if (args[0] === '--diff') {
  const read = (f: string) => JSON.parse(readFileSync(resolve(process.cwd(), f), 'utf8')) as Snapshot
  const text = diff(read(args[1]!), args[2] ? read(args[2]) : snapshot())
  if (args[3]) writeFileSync(resolve(process.cwd(), args[3]), `${text}\n`)
  else console.log(text)
} else if (args[0] === '--pins') {
  console.log(pins())
} else {
  const ref = iauc(run('glucose-50:1'))
  for (const [meal, target] of CALIBRATION) {
    const sim = run(meal)
    const e = sim.events
    console.log(
      meal.padEnd(24),
      `kcal ${sim.meal.total.energyKcal.toFixed(0).padStart(4)}`,
      `t50 ${e.stomachHalfEmptyMin} t90 ${e.stomach90EmptyMin}`,
      `ret 1/2/4h ${pct(sim, 60).toFixed(0)}/${pct(sim, 120).toFixed(0)}/${pct(sim, 240).toFixed(0)}%`,
      `peak ${e.glucosePeak ? `+${e.glucosePeak.riseMgDl.typical.toFixed(0)}@${e.glucosePeak.timeMin}` : '-'}`,
      `abs90 ${e.absorptionMostlyDoneMin}`,
      `iAUC ${(iauc(sim) / ref).toFixed(2)}`,
      `| ${target}`,
    )
  }
}
