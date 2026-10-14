/**
 * The engine worker (W-2, architecture §3.2): the run off the page, so a slow phone's page stays
 * quick to answer while a run is worked out. Three parts:
 *   - `handle`: the worker's whole job, a pure function (one request in, one reply out), which the
 *     tests call directly;
 *   - `serve`: the one engine file's start (apps/web/src/engine-worker.ts, a classic iife script).
 *     In a worker it answers messages; as a page script it hands `handle` to the page instead;
 *   - `connectWorker`: the page's side (in the run chunk, beside `simulate`). It sends a run only
 *     once the worker has said it is ready, one at a time (newest of each lane first: a run asked
 *     again before its turn is dropped), and gives up on the worker for the session on an error
 *     event, an exception while making it, or no answer within 3 s of sending a run. A run it
 *     cannot send, or that the worker fails on, is made on the page instead, as without workers;
 *     a run superseded meanwhile is not made at all.
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
   * or does not answer in time (it is then given up), on the page. Rejects if the run itself does,
   * or with SUPERSEDED once a newer run of the same `lane` is asked (its result is never made or used).
   */
  run(input: RunInput, opts: SimOptions & { lookup: FoodLookup; lane?: string }): Promise<RunResult>
}

/** How long a run may take in the worker, from being sent, before the page gives up on it (architecture §3.2). */
export const WORKER_TIMEOUT_MS = 3000

/** A run's rejection when a newer run of its lane was asked before it was done (R120 #7). */
export const SUPERSEDED = new Error('superseded by a newer run')

/** A run asked of the worker, not answered yet. */
interface Job {
  id: number
  lane?: string
  request: RunRequest
  resolve: (w: WireResult) => void
  reject: (e: Error) => void
}

/**
 * Opens the worker (`open`, e.g. `() => new Worker(url)`) and talks to it. Never throws: a worker
 * that cannot be made, fails or goes quiet is only never `ready()` again.
 */
export function connectWorker(open: () => WorkerPort, timeoutMs = WORKER_TIMEOUT_MS): WorkerRunner {
  let state: 'starting' | 'ready' | 'dead' = 'starting'
  let port: WorkerPort | null = null
  let next = 0
  // At most one run in the worker (R120 #7): queued runs never time out while a slow phone works
  // through the ones before them. `newest`: each lane's latest run; an older one is superseded.
  let sent: Job | null = null
  const queue: Job[] = []
  const newest = new Map<string, number>()
  // One watchdog, for the run in the worker: started when it is sent, so restarted after each reply.
  let watchdog: ReturnType<typeof setTimeout> | undefined
  const send = () => {
    if (sent || state !== 'ready' || !queue.length) return
    sent = queue.shift()!
    watchdog = setTimeout(die, timeoutMs)
    try {
      port!.postMessage(sent.request)
    } catch {
      die()
    }
  }
  const die = () => {
    if (state === 'dead') return
    state = 'dead'
    clearTimeout(watchdog)
    try {
      port?.terminate()
    } catch {
      // Gone already.
    }
    // Made on the page instead, each unless superseded (`run`'s fallback).
    for (const job of [sent, ...queue.splice(0)]) job?.reject(new Error('engine worker failed'))
    sent = null
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
      const job = sent
      if (!job || reply?.id !== job.id) return
      clearTimeout(watchdog)
      sent = null
      if (reply.type === 'result') job.resolve(reply.result)
      else job.reject(new Error(reply.error))
      send()
    }
  } catch {
    die()
  }
  return {
    ready: () => state === 'ready',
    run(input, opts) {
      const { lane } = opts
      const id = ++next
      if (lane) newest.set(lane, id)
      const stale = () => !!lane && newest.get(lane) !== id
      const here = () => {
        if (stale()) throw SUPERSEDED
        return simulate(input, opts)
      }
      if (state !== 'ready') return Promise.resolve().then(here)
      const foods = input.items.flatMap((i) => opts.lookup(i.foodId) ?? [])
      return new Promise<WireResult>((resolve, reject) => {
        // Newest wins: this lane's run still waiting its turn is dropped (one in the worker is left
        // to finish, and its result is not used).
        const older = lane ? queue.findIndex((j) => j.lane === lane) : -1
        if (older >= 0) queue.splice(older, 1)[0]!.reject(SUPERSEDED)
        queue.push({ id, lane, request: { type: 'run', id, input, foods, particles: opts.particles }, resolve, reject })
        send()
      }).then(
        (wire) => {
          if (stale()) throw SUPERSEDED
          return fromWire(wire, opts.lookup)
        },
        (e: unknown) => (e === SUPERSEDED ? Promise.reject(e) : here()),
      )
    },
  }
}
