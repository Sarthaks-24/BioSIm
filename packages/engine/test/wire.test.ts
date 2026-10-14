import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFood } from '../src/schema.ts'
import { simulate } from '../src/simulate.ts'
import { RUN_EVENTS, RUN_SIGNALS } from '../src/core/catalog/rows.ts'
import { fromWire, toWire } from '../src/wire.ts'
import { connectWorker, handle, serve, type RunRequest, type WorkerPort, type WorkerReply } from '../src/worker.ts'
import type { RunInput, RunResult } from '../src/result.ts'
import { firstDiff } from './fixtures.ts'

// The engine worker's wire format and protocol (W-2, architecture §3.2).

const foodsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const FOODS = readdirSync(foodsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(foodsDir, f), 'utf8'))))
const lookup = (id: string) => FOODS.find((f) => f.id === id)
const foodsOf = (input: RunInput) => input.items.flatMap((i) => lookup(i.foodId) ?? [])

/** The stage's runs: the current run draws 56 dots, a kept run none (apps/web hooks/useRun.ts). */
const SCENARIOS: { name: string; input: RunInput; particles: number }[] = [
  { name: 'a drink (cola)', input: { items: [{ foodId: 'cola', servings: 1 }], profile: 'adult-ref', activity: [] }, particles: 56 },
  {
    name: 'a fatty solid meal (burger and fries)',
    input: {
      items: [
        { foodId: 'cheeseburger', servings: 1 },
        { foodId: 'fries', servings: 1 },
      ],
      profile: 'adult-ref',
      activity: [],
    },
    particles: 56,
  },
  {
    name: 'a mixed meal with a walk',
    input: {
      items: [
        { foodId: 'roti', servings: 2 },
        { foodId: 'dal', servings: 1 },
        { foodId: 'green-salad', servings: 1 },
      ],
      profile: 'adult-ref',
      activity: [{ kind: 'walk', startMin: 30, durMin: 20 }],
    },
    particles: 56,
  },
  {
    name: 'water (nothing to absorb)',
    input: { items: [{ foodId: 'water', servings: 1 }], profile: 'adult-ref', activity: [] },
    particles: 56,
  },
  {
    name: 'a kept run with two bouts (no dots)',
    input: {
      items: [
        { foodId: 'idli', servings: 2 },
        { foodId: 'banana', servings: 1 },
      ],
      profile: 'adult-ref',
      activity: [
        { kind: 'walkBrisk', startMin: 60, durMin: 30 },
        { kind: 'run', startMin: 240, durMin: 20 },
      ],
    },
    particles: 0,
  },
  {
    name: 'a run with no meal',
    input: { items: [], profile: 'adult-ref', activity: [{ kind: 'run', startMin: 0, durMin: 30 }] },
    particles: 56,
  },
]

const run = ({ input, particles }: (typeof SCENARIOS)[number]) => simulate(input, { lookup, particles })

/** Every Float32 array of a run, to the byte, against another run's; and the rows are the catalog's own objects. */
function expectSame(back: RunResult, want: RunResult) {
  expect(back).toStrictEqual(want)
  expect([...back.signals.keys()]).toEqual([...want.signals.keys()])
  expect([...back.moments.keys()]).toEqual([...want.moments.keys()])
  for (const [id, s] of want.signals) {
    const b = back.signals.get(id)!
    expect(b.meta).toBe(RUN_SIGNALS[id])
    expect(firstDiff(s.values, b.values), id).toBe(-1)
    if (s.low) expect(firstDiff(s.low, b.low), `${id}.low`).toBe(-1)
    if (s.high) expect(firstDiff(s.high, b.high), `${id}.high`).toBe(-1)
  }
  for (const [id, p] of back.moments) expect(p.meta).toBe(RUN_EVENTS[id])
  back.meal.items.forEach((it, i) => expect(it.food).toBe(want.meal.items[i]!.food))
}

describe('the wire format (toWire / fromWire)', () => {
  for (const s of SCENARIOS)
    it(`round trip deep-equals the run, every array to the byte: ${s.name}`, () => {
      const want = run(s)
      const { wire, transfer } = toWire(run(s))
      expectSame(fromWire(structuredClone(wire, { transfer }), lookup), want)
    })

  it('transfers every array (zero copy): the sent run keeps none of its buffers', () => {
    const sent = run(SCENARIOS[2]!)
    const { wire, transfer } = toWire(sent)
    const arrays = [...sent.signals.values()].flatMap((s) => [s.values, s.low, s.high].filter((a) => a !== undefined))
    expect(transfer).toHaveLength(arrays.length)
    structuredClone(wire, { transfer })
    for (const a of arrays) expect(a.byteLength).toBe(0)
  })

  it('carries no catalog rows: only their IDs cross', () => {
    const { wire } = toWire(run(SCENARIOS[0]!))
    expect(JSON.stringify(wire, (_, v) => (ArrayBuffer.isView(v) ? undefined : v))).not.toContain('reactsToMeal')
  })
})

describe('the worker protocol (handle, serve, connectWorker)', () => {
  afterEach(() => vi.useRealTimers())

  it('handle: the worker’s reply is the run, deep-equal to the page’s own, for every scenario', () => {
    SCENARIOS.forEach((s, i) => {
      const { reply, transfer } = handle({ type: 'run', id: i, input: s.input, foods: foodsOf(s.input), particles: s.particles })
      expect(reply.type).toBe('result')
      if (reply.type !== 'result') return
      expect(reply.id).toBe(i)
      expectSame(fromWire(structuredClone(reply.result, { transfer }), lookup), run(s))
    })
  })

  it('handle: a run the engine refuses is an error reply, not a throw', () => {
    const bad: RunRequest = {
      type: 'run',
      id: 7,
      input: { items: [], profile: 'nobody' as 'adult-ref', activity: [] },
      foods: [],
      particles: 0,
    }
    expect(handle(bad).reply).toMatchObject({ type: 'error', id: 7, error: expect.stringContaining('unknown profile') })
  })

  it('serve: in a worker it says it is ready and answers runs; on a page it hands over handle', () => {
    const posted: unknown[] = []
    const scope = {
      importScripts: () => {},
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage: (m: unknown) => posted.push(m),
    }
    serve(scope)
    expect(posted).toEqual([{ type: 'ready' }])
    const s = SCENARIOS[0]!
    scope.onmessage!({ data: { type: 'run', id: 1, input: s.input, foods: foodsOf(s.input), particles: s.particles } })
    expect(posted[1]).toMatchObject({ type: 'result', id: 1 })
    const page: { __lifepeekEngine?: { handle: typeof handle } } = {}
    serve(page)
    expect(page.__lifepeekEngine?.handle).toBe(handle)
  })

  /** A worker in the test: `handle` answers on the next tick, unless told to stay quiet. */
  function fakeWorker({ ready = true, quiet = false } = {}) {
    const port: WorkerPort & { sent: number; terminated: boolean } = {
      onmessage: null,
      onerror: null,
      sent: 0,
      terminated: false,
      postMessage(msg) {
        port.sent++
        if (quiet) return
        const { reply, transfer } = handle(msg as RunRequest)
        const data = structuredClone(reply, { transfer })
        queueMicrotask(() => port.onmessage?.({ data }))
      },
      terminate() {
        port.terminated = true
      },
    }
    if (ready) queueMicrotask(() => port.onmessage?.({ data: { type: 'ready' } satisfies WorkerReply }))
    return port
  }
  const s = SCENARIOS[2]!

  const opts = { lookup, particles: s.particles }

  it('sends runs only once the worker has said it is ready (before that, on the page); the answer is the run', async () => {
    const port = fakeWorker()
    const runner = connectWorker(() => port)
    expect(runner.ready()).toBe(false)
    expectSame(await runner.run(s.input, opts), run(s))
    expect(port.sent).toBe(0)
    expect(runner.ready()).toBe(true)
    expectSame(await runner.run(s.input, opts), run(s))
    expect(port.sent).toBe(1)
  })

  it('a worker that cannot be made, or fails (an error event), is never ready again: runs are made on the page', async () => {
    const broken = connectWorker(() => {
      throw new Error('SecurityError')
    })
    await Promise.resolve()
    expect(broken.ready()).toBe(false)
    expectSame(await broken.run(s.input, opts), run(s))
    const port = fakeWorker()
    const runner = connectWorker(() => port)
    await Promise.resolve()
    port.onerror!(new Error('404'))
    expect(runner.ready()).toBe(false)
    expect(port.terminated).toBe(true)
  })

  it('no answer in 3 s: the worker is given up for the session, and the run is made on the page', async () => {
    vi.useFakeTimers()
    const port = fakeWorker({ quiet: true })
    const runner = connectWorker(() => port)
    await Promise.resolve()
    expect(runner.ready()).toBe(true)
    let done: RunResult | null = null
    const answer = runner.run(s.input, opts).then((r) => (done = r))
    await vi.advanceTimersByTimeAsync(2999)
    expect(done).toBeNull()
    expect(runner.ready()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    await answer
    expectSame(done!, run(s))
    expect(runner.ready()).toBe(false)
    expect(port.terminated).toBe(true)
    await runner.run(s.input, opts)
    expect(port.sent).toBe(1)
  })

  it('a run the engine refuses is refused on the page too (the worker stays)', async () => {
    const port = fakeWorker()
    const runner = connectWorker(() => port)
    await Promise.resolve()
    await expect(runner.run({ ...s.input, profile: 'nobody' as 'adult-ref' }, opts)).rejects.toThrow('unknown profile')
    expect(port.sent).toBe(1)
    expect(runner.ready()).toBe(true)
  })
})
