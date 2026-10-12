import { timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { feedback, type Db } from './db.ts'

/**
 * The BioSim API does one job: receive "report a mistake" messages so the science can be
 * checked. It stores no personal data — no accounts, no emails, no IP addresses.
 * (Share links don't need a server: the whole comparison lives in the URL.)
 */
export interface AppOptions {
  db: Db
  /** Origins allowed to call the API from a browser. */
  allowedOrigins: string[]
  /** Bearer token for reading reports. Reading is disabled if unset. */
  adminToken?: string
  /** Reports per minute per client. */
  writeLimitPerMinute?: number
  /**
   * Who is calling, for rate limiting. The server passes the socket address; behind a trusted
   * proxy it may use the forwarded header instead. Never trust client-sent headers by default.
   */
  clientKey?: (c: Context) => string
}

/** At most this many clients are tracked at once; beyond that new clients are refused until the window resets. */
const MAX_TRACKED_CLIENTS = 5_000

/** Fixed one-minute window per client, with a hard cap on memory. */
export function rateLimiter(limit: number, now: () => number = Date.now) {
  let windowStart = now()
  const hits = new Map<string, number>()
  return (key: string): boolean => {
    if (now() - windowStart >= 60_000) {
      hits.clear()
      windowStart = now()
    }
    const count = hits.get(key)
    if (count === undefined && hits.size >= MAX_TRACKED_CLIENTS) return false
    hits.set(key, (count ?? 0) + 1)
    return (count ?? 0) + 1 <= limit
  }
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const FeedbackInput = z.object({
  location: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(2000),
  source: z.string().trim().max(500).optional(),
  /** The share-link query the reporter was looking at, so we can reproduce it. */
  context: z.string().max(500).default(''),
})
export type FeedbackInput = z.infer<typeof FeedbackInput>

export function createApp(opts: AppOptions) {
  const { db } = opts
  const allowWrite = rateLimiter(opts.writeLimitPerMinute ?? 10)
  const clientKey = opts.clientKey ?? (() => 'local')
  const app = new Hono().basePath('/api')

  app.use('*', secureHeaders())
  app.use('*', cors({ origin: opts.allowedOrigins, allowMethods: ['GET', 'POST'], maxAge: 600 }))
  app.use('*', bodyLimit({ maxSize: 16 * 1024 }))

  app.get('/health', (c) => c.json({ ok: true }))

  app.post('/feedback', async (c) => {
    if (!allowWrite(clientKey(c))) return c.json({ error: 'Too many reports — try again in a minute' }, 429)
    const parsed = FeedbackInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Invalid report', fields: parsed.error.issues.map((i) => i.path.join('.')) }, 400)
    const f = parsed.data
    await db.insert(feedback).values({
      location: f.location,
      message: f.message,
      source: f.source || null,
      context: f.context,
      createdAt: new Date(),
    })
    return c.json({ ok: true }, 201)
  })

  /** Reviewers read reports with the admin token. Returned as JSON only (never rendered as HTML). */
  app.get('/feedback', async (c) => {
    const auth = c.req.header('authorization') ?? ''
    if (!opts.adminToken || !sameSecret(auth, `Bearer ${opts.adminToken}`)) return c.json({ error: 'Unauthorized' }, 401)
    const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(200)
    return c.json({ items: rows })
  })

  app.notFound((c) => c.json({ error: 'Not found' }, 404))
  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'Server error' }, 500)
  })

  return app
}
