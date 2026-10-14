import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_RUN, useRunStore } from '../state/run.ts'
import { pickerSystems } from '../systems/registry.ts'
import { stepLayer } from './SystemTitle.tsx'

const run = () => useRunStore.getState()

beforeEach(() => useRunStore.setState({ ...INITIAL_RUN }))

describe('[ ] and ‹ › (ui-ux §3.2)', () => {
  it('pressed quickly while a row is on its way, each press moves on from that row (R120 #6)', () => {
    const rows = pickerSystems(false).map((s) => s.id)
    // No pack arrives in a unit test: every row but Digestion stays on its way.
    stepLayer(1)
    expect(run().switching?.to).toBe(rows[1])
    stepLayer(1)
    expect(run().switching?.to).toBe(rows[2])
    stepLayer(-1)
    stepLayer(-1)
    // Back to the lit row: Digestion, lit at once.
    expect(run().layer).toBe('digestion')
    expect(run().switching).toBeNull()
  })

  it('after a failed load, from the lit row', () => {
    const rows = pickerSystems(false).map((s) => s.id)
    useRunStore.setState({ switching: { to: rows[3]!, failed: true } })
    stepLayer(1)
    expect(run().switching?.to).toBe(rows[1])
  })
})
