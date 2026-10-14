// The engine worker (W-2, architecture §3.2): one classic script (the build's `worker.format` is
// iife, since old Android Chrome has no module workers). In a worker it answers runs; loaded as a
// page script it offers `globalThis.__lifepeekEngine.handle` instead (packages/engine/src/worker.ts).
// Lazy (R71): only the stage asks for it, after its first run, and the service worker keeps it in
// lp-lazy once fetched. Without it (no Worker, offline before it was fetched, a worker that goes
// quiet) the page runs the engine itself (hooks/useRun.ts).
import { serve } from '@lifepeek/engine/worker'

serve()
