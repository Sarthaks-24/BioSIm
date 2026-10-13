// The model seal (MODEL D12, E-3a): no production deploy carries a model version that is not
// sealed yet. Model version 3 is built over several steps on the `v3` branch (E-3a, E-3b, S-1…S-4)
// and its numbers may still move until `MODEL_SEALED = true` in packages/engine/src/params.ts.
//
// Runs in `npm run build` before vite (so a Vercel production build fails) and as check 7 of the
// release gate:
//
//   node apps/web/scripts/model-seal.mjs              blocks only a production deploy (VERCEL_ENV=production)
//   node apps/web/scripts/model-seal.mjs --release    blocks any unsealed version (release gate)
//
// A Vercel preview, CI and a local build go on, with a line saying the version is unsealed.
// A params.ts without MODEL_SEALED (main before the v3 merge) counts as sealed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const PARAMS_FILE = path.join(root, 'packages', 'engine', 'src', 'params.ts')

/** MODEL_VERSION and MODEL_SEALED as written in params.ts. */
export function readSeal(text) {
  const version = /^export const MODEL_VERSION = (\d+)\s*$/m.exec(text)
  if (!version) throw new Error('params.ts: no "export const MODEL_VERSION = <n>" line')
  const sealed = /^export const MODEL_SEALED = (true|false)\s*$/m.exec(text)
  return { version: Number(version[1]), sealed: sealed ? sealed[1] === 'true' : true }
}

/** Why this build must stop, or null. `production`: a production deploy or a release. */
export function sealProblem({ version, sealed }, production) {
  if (sealed || !production) return null
  return (
    `Model version ${version} is not sealed (MODEL_SEALED = false in packages/engine/src/params.ts): ` +
    'it may not go to production. Seal it after E-3b and S-1…S-4 (MODEL D12), or deploy a sealed branch.'
  )
}

// Run only when called as a script, not when the unit test imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seal = readSeal(fs.readFileSync(PARAMS_FILE, 'utf8'))
  const production = process.argv.includes('--release') || process.env.VERCEL_ENV === 'production'
  const problem = sealProblem(seal, production)
  if (problem) {
    console.error(`model-seal: ${problem}`)
    process.exit(1)
  }
  console.log(
    seal.sealed
      ? `model-seal: model version ${seal.version} is sealed.`
      : `model-seal: model version ${seal.version} is NOT sealed: fine here, blocked for a production deploy.`,
  )
}
