import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { decodeShareState, encodeShareState } from '@biosim/engine'
import { feedback, shortLinks, type Db } from './db.ts'

export interface AppOptions {
  db: Db
  /** Origins allowed to call the API from a browser. */
  allowedOrigins: string[]
  /** Bearer token for reading feedback. Reading is disabled if unset. */
  adminToken?: string
  /** Requests per minute per client for write endpoints. */
  writeLimitPerMinute?: number
}

const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no look-alikes (l/1, o/0)

function newCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** Small in-memory fixed-window limiter. Fine for one instance; swap for a shared store if scaled out. */
function rateLimiter(limit: number) {
  const hits = new Map<string, { count: number; reset: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + 60_000 })
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      return true
    }
    entry.count++
    return entry.count <= limit
  }
}

const clientKey = (c: Context) =>
  c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'local'

const LinkInput = z.object({ query: z.string().min(1).max(500) })

const FeedbackInput = z.object({
  location: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(2000),
  source: z.string().trim().max(500).optional(),
  email: z.email().max(200).optional(),
  context: z.string().max(500).default(''),
})

export function createApp(opts: AppOptions) {
  const { db } = opts
  const allowWrite = rateLimiter(opts.writeLimitPerMinute ?? 20)
  const app = new Hono().basePath('/api')

  app.use('*', secureHeaders())
  app.use('*', cors({ origin: opts.allowedOrigins, allowMethods: ['GET', 'POST'], maxAge: 600 }))
  app.use('*', bodyLimit({ maxSize: 16 * 1024 }))
  app.use('*', async (c, next) => {
    if (c.req.method === 'POST' && !allowWrite(clientKey(c))) return c.json({ error: 'Too many requests' }, 429)
    await next()
  })

  app.get('/health', (c) => c.json({ ok: true }))

  /** Create (or reuse) a short code for a comparison. Only valid share queries are stored. */
  app.post('/links', async (c) => {
    const parsed = LinkInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Invalid body' }, 400)
    const state = decodeShareState(new URLSearchParams(parsed.data.query))
    if (state.a.length === 0 && state.b.length === 0) return c.json({ error: 'Link has no meals' }, 400)
    // Store the canonical form so the same comparison always gets the same code.
    const canonical = encodeShareState({ a: state.a, b: state.b, t: state.t }).toString()

    const existing = await db.select().from(shortLinks).where(eq(shortLinks.query, canonical)).get()
    if (existing) return c.json({ code: existing.code })

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode()
      try {
        await db.insert(shortLinks).values({ code, query: canonical, createdAt: new Date() })
        return c.json({ code }, 201)
      } catch {
        // Code collision or a concurrent insert of the same query: retry / re-read.
        const again = await db.select().from(shortLinks).where(eq(shortLinks.query, canonical)).get()
        if (again) return c.json({ code: again.code })
      }
    }
    return c.json({ error: 'Could not create link' }, 500)
  })

  app.get('/links/:code', async (c) => {
    const code = c.req.param('code')
    if (!/^[a-z2-9]{4,12}$/.test(code)) return c.json({ error: 'Not found' }, 404)
    const row = await db.select().from(shortLinks).where(eq(shortLinks.code, code)).get()
    if (!row) return c.json({ error: 'Not found' }, 404)
    await db
      .update(shortLinks)
      .set({ hits: sql`${shortLinks.hits} + 1` })
      .where(eq(shortLinks.code, code))
    return c.json({ query: row.query })
  })

  /** "Report a mistake". Email is optional and only used to reply. */
  app.post('/feedback', async (c) => {
    const parsed = FeedbackInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Invalid body', issues: parsed.error.issues.map((i) => i.path.join('.')) }, 400)
    const f = parsed.data
    await db.insert(feedback).values({
      location: f.location,
      message: f.message,
      source: f.source || null,
      email: f.email || null,
      context: f.context,
      createdAt: new Date(),
    })
    return c.json({ ok: true }, 201)
  })

  /** Reviewers read reports with the admin token. */
  app.get('/feedback', async (c) => {
    const auth = c.req.header('authorization')
    if (!opts.adminToken || auth !== `Bearer ${opts.adminToken}`) return c.json({ error: 'Unauthorized' }, 401)
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
