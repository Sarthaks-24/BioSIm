import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PARAMS_FILE, readSeal, sealProblem } from './model-seal.mjs'

const script = fileURLToPath(new URL('./model-seal.mjs', import.meta.url))
const run = (args, env) =>
  spawnSync(process.execPath, [script, ...args], { env: { ...process.env, VERCEL_ENV: '', ...env }, encoding: 'utf8' })

describe('model seal (MODEL D12)', () => {
  it('reads MODEL_VERSION and MODEL_SEALED; a params.ts without MODEL_SEALED counts as sealed', () => {
    expect(readSeal('export const MODEL_VERSION = 3\nexport const MODEL_SEALED = false\n')).toEqual({ version: 3, sealed: false })
    expect(readSeal('export const MODEL_VERSION = 3\nexport const MODEL_SEALED = true\n')).toEqual({ version: 3, sealed: true })
    expect(readSeal('export const MODEL_VERSION = 2\n')).toEqual({ version: 2, sealed: true })
    expect(() => readSeal('const x = 1')).toThrow()
  })

  it('an unsealed version is blocked only for production', () => {
    expect(sealProblem({ version: 3, sealed: false }, true)).toMatch(/not sealed/)
    expect(sealProblem({ version: 3, sealed: false }, false)).toBeNull()
    expect(sealProblem({ version: 3, sealed: true }, true)).toBeNull()
    expect(sealProblem({ version: 3, sealed: true }, true, false)).toMatch(/sealed\/v3\.json is missing/)
    expect(sealProblem({ version: 3, sealed: true }, false, false)).toBeNull()
  })

  it('the script on this params.ts: unsealed fails a Vercel production build and the release gate; a preview passes', () => {
    const seal = readSeal(fs.readFileSync(PARAMS_FILE, 'utf8'))
    expect(run([], { VERCEL_ENV: 'production' }).status).toBe(seal.sealed ? 0 : 1)
    expect(run(['--release'], {}).status).toBe(seal.sealed ? 0 : 1)
    expect(run([], { VERCEL_ENV: 'preview' }).status).toBe(0)
    expect(run([], {}).status).toBe(0)
  })
})
