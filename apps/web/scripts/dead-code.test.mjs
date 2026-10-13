import { describe, expect, it } from 'vitest'
import { actionsOf, exportsOf, findDeadCode } from './dead-code.mjs'

describe('dead code (B25)', () => {
  it('reads exports, re-exports and their targets', () => {
    const text = "export const A = 1\nexport function Chip() {}\nexport { default as Tag, type TagProps } from './Tag.tsx'\n"
    expect(exportsOf(text, 'kit/index.ts')).toEqual([
      { name: 'A', component: false },
      { name: 'Chip', component: false },
      { name: 'Tag', target: 'kit/Tag.tsx', component: true },
      { name: 'TagProps', target: 'kit/Tag.tsx', component: false },
    ])
    expect(exportsOf('export default function Card() {}\nexport function Row() {}', 'x/Card.tsx')[0]).toEqual({
      name: 'Row',
      component: true,
    })
  })

  it('reads the store actions of a …State interface', () => {
    expect(actionsOf('export interface RunState {\n  meal: string[]\n  keep: () => void\n  swap?: (a: number) => void\n}\n')).toEqual([
      'keep',
      'swap',
    ])
  })

  it('finds an export nothing uses, a component only tests render, and a store action only tests call', () => {
    const files = {
      'lib/a.ts': 'export const used = 1\nexport const unused = 2\nexport const ownUse = 3\nconst x = ownUse\n',
      'kit/index.ts': "export { default as Tag } from './Tag.tsx'\nexport { default as Chip } from './Chip.tsx'\n",
      'kit/Tag.tsx': 'export default function Tag() {}',
      'kit/Chip.tsx': 'export default function Chip() {}',
      'kit/kit.test.ts': 'Tag; Chip',
      'pages/Page.tsx': 'used; Chip; run().keep()',
      'state/run.ts':
        'export interface RunState {\n  keep: () => void\n  swapKept: () => void\n}\nconst s: RunState = { keep() {}, swapKept() {} }\n',
      'state/run.test.ts': 'run().swapKept()',
      '../e2e/x.spec.ts': '',
    }
    expect(findDeadCode(files, {})).toEqual([
      'lib/a.ts: export unused is used nowhere',
      'kit/index.ts: component Tag is only used by tests',
      'state/run.ts: store action swapKept is never called by the app',
    ])
    expect(findDeadCode(files, { 'lib/a.ts unused': 'kept for later' })).toHaveLength(2)
  })

  it('counts e2e and scripts as users of an export, never as app code', () => {
    const files = { 'lib/a.ts': 'export const forE2e = 1', '../e2e/x.spec.ts': 'forE2e' }
    expect(findDeadCode(files, {})).toEqual([])
  })
})
