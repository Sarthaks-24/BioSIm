/**
 * Validates every file in content/foods against the schema. Run in CI and before every PR:
 *   npm run validate
 */
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Food } from '../src/schema.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
let failures = 0

for (const file of files) {
  const path = join(dir, file)
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`✗ ${file}: not valid JSON — ${(err as Error).message}`)
    failures++
    continue
  }
  const result = Food.safeParse(data)
  if (!result.success) {
    failures++
    console.error(`✗ ${file}`)
    for (const issue of result.error.issues) console.error(`    ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    continue
  }
  if (result.data.id !== basename(file, '.json')) {
    failures++
    console.error(`✗ ${file}: id "${result.data.id}" must match the file name`)
    continue
  }
  console.log(`✓ ${file}`)
}

console.log(`\n${files.length - failures}/${files.length} food files valid`)
if (failures > 0 || files.length === 0) process.exit(1)
