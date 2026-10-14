/**
 * The engine worker (W-2, architecture §3.2): the run off the page, so a slow phone's page stays
 * quick to answer while a run is worked out. Three parts:
 *   - `handle`: the worker's whole job, a pure function (one request in, one reply out), which the
 *     tests call directly;
 *   - `serve`: the one engine file's start (apps/web/src/engine-worker.ts, a classic iife script).
 *     In a worker it answers messages; as a page script it hands `handle` to the page instead;
 *   - `connectWorker`: the page's side (in the run chunk, beside `simulate`). It sends a run only
 *     once the worker has said it is ready, and gives up on the worker for the session on an error
 *     event, an exception while making it, or no answer within 3 s. A run it cannot send, or that
 *     the worker fails on, is made on the page instead, as without workers.
 * The transport is injected, so the tests need no browser. The worker's file imports `serve` from
 * `@lifepeek/engine/worker`; the run chunk exports only `connectWorker` (and `fromWire` through it),
 * so the page never downloads the worker's half.
 */
import type { FoodLookup } from './meal.ts'
import type { RunInput, RunResult } from './result.ts'
import type { Food } from './schema.ts'
import { simulate, type SimOptions } from './simulate.ts'
import { fromWire, toWire, type WireResult } from './wire.ts'

/** One run asked of the worker: its input, the foods it names (the worker has no food list), and the dots wanted. */
export interface RunRequest {
  type: 'run'
  id: number
  input: RunInput
  foods: readonly Food[]
  /** Dots for the picture (simulate's default when left out). */
  particles?: number
}

export type WorkerReply =
  { type: 'ready' } | { type: 'result'; id: number; result: WireResult } | { type: 'error'; id: number; error: string }

/** The worker's job: the run, on the wire, with its arrays to transfer (or what went wrong). */
export function handle(msg: RunRequest): { reply: WorkerReply; transfer: ArrayBuffer[] } {
  try {
    const foods = new Map(msg.foods.map((f) => [f.id, f]))
    const { wire, transfer } = toWire(simulate(msg.input, { lookup: (id) => foods.get(id), particles: msg.particles }))
    return { reply: { type: 'result', id: msg.id, result: wire }, transfer }
  } catch (e) {
    return { reply: { type: 'error', id: msg.id, error: e instanceof Error ? e.message : String(e) }, transfer: [] }
  }
}

/** What `serve` needs of its host: a worker's global scope, or the page's. */
interface Host {
  postMessage?(message: unknown, transfer?: ArrayBuffer[]): void
  onmessage?: ((e: { data: unknown }) => void) | null
  importScripts?: unknown
  __lifepeekEngine?: { handle: typeof handle }
}

/** Starts the engine file: in a worker, answers runs (and says it is ready); on a page, offers `handle`. */
export function serve(host: Host = globalThis as Host) {
  if (typeof host.importScripts !== 'function') {
    host.__lifepeekEngine = { handle }
    return
  }
  host.onmessage = ({ data }) => {
    if ((data as RunRequest | null)?.type !== 'run') return
    const { reply, transfer } = handle(data as RunRequest)
    host.postMessage!(reply, transfer)
  }
  host.postMessage!({ type: 'ready' } satisfies WorkerReply)
}

/** The page's view of a worker (a `Worker` is one). */
export interface WorkerPort {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: unknown) => void) | null
  terminate(): void
}

export interface WorkerRunner {
  /** The worker has said it is ready, and has not failed: runs go to it. */
  ready(): boolean
  /**
   * `simulate(input, opts)`, worked out by the worker when it is ready; otherwise, or when it fails
   * or does not answer in time (it is then given up), on the page. Rejects only if the run itself does.
   */
  run(input: RunInput, opts: SimOptions & { lookup: FoodLookup }): Promise<RunResult>
}

/** How long a run may take in the worker before the page gives up on it (architecture §3.2). */
export const WORKER_TIMEOUT_MS = 3000

/**
 * Opens the worker (`open`, e.g. `() => new Worker(url)`) and talks to it. Never throws: a worker
 * that cannot be made, fails or goes quiet is only never `ready()` again.
 */
export function connectWorker(open: () => WorkerPort, timeoutMs = WORKER_TIMEOUT_MS): WorkerRunner {
  let state: 'starting' | 'ready' | 'dead' = 'starting'
  let port: WorkerPort | null = null
  let next = 0
  const waiting = new Map<number, { resolve: (w: WireResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  const die = () => {
    if (state === 'dead') return
    state = 'dead'
    try {
      port?.terminate()
    } catch {
      // Gone already.
    }
    for (const w of waiting.values()) {
      clearTimeout(w.timer)
      w.reject(new Error('engine worker failed'))
    }
    waiting.clear()
  }
  try {
    port = open()
    port.onerror = die
    port.onmessage = ({ data }) => {
      const reply = data as WorkerReply
      if (reply?.type === 'ready') {
        if (state === 'starting') state = 'ready'
        return
      }
      const w = reply && waiting.get(reply.id)
      if (!w) return
      waiting.delete(reply.id)
      clearTimeout(w.timer)
      if (reply.type === 'result') w.resolve(reply.result)
      else w.reject(new Error(reply.error))
    }
  } catch {
    die()
  }
  return {
    ready: () => state === 'ready',
    run(input, opts) {
      const here = () => simulate(input, opts)
      if (state !== 'ready') return Promise.resolve().then(here)
      const id = ++next
      const foods = input.items.flatMap((i) => opts.lookup(i.foodId) ?? [])
      return new Promise<WireResult>((resolve, reject) => {
        waiting.set(id, { resolve, reject, timer: setTimeout(die, timeoutMs) })
        try {
          port!.postMessage({ type: 'run', id, input, foods, particles: opts.particles } satisfies RunRequest)
        } catch {
          die()
        }
      }).then((wire) => fromWire(wire, opts.lookup), here)
    },
  }
}
