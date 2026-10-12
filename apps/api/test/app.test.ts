import { beforeEach, describe, expect, it } from 'vitest'
import { clientKeyFrom, createApp, rateLimiter } from '../src/app.ts'
import { openDb } from '../src/db.ts'

let app: ReturnType<typeof createApp>

beforeEach(async () => {
  const { db } = await openDb(':memory:')
  app = createApp({
    db,
    allowedOrigins: ['http://localhost:5173'],
    adminToken: 'secret',
    writeLimitPerMinute: 5,
    // Like the real server: the key comes from the connection, not from anything the client sends.
    clientKey: (c) => c.req.header('x-test-socket') ?? 'local',
  })
})

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/api${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })

const report = { location: 'Stomach panel', message: 'The pepsin sentence should mention pH.', context: 'a=cola:1' }

describe('feedback', () => {
  it('stores a report and hides the list without the token', async () => {
    expect((await post('/feedback', report)).status).toBe(201)
    expect((await app.request('/api/feedback')).status).toBe(401)
    expect((await app.request('/api/feedback', { headers: { authorization: 'Bearer wrong!' } })).status).toBe(401)
    const res = await app.request('/api/feedback', { headers: { authorization: 'Bearer secret' } })
    const { items } = (await res.json()) as { items: Record<string, unknown>[] }
    expect(items).toHaveLength(1)
    expect(items[0]).not.toHaveProperty('email')
  })

  it('validates input', async () => {
    expect((await post('/feedback', { ...report, message: 'short' })).status).toBe(400)
    expect((await post('/feedback', { nope: 1 })).status).toBe(400)
  })

  it('rate limits per client, and a spoofed X-Forwarded-For does not help', async () => {
    const statuses = []
    for (let i = 0; i < 7; i++) {
      statuses.push((await post('/feedback', report, { 'x-test-socket': '1.2.3.4', 'x-forwarded-for': `10.0.0.${i}` })).status)
    }
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    // A different connection is unaffected.
    expect((await post('/feedback', report, { 'x-test-socket': '5.6.7.8' })).status).toBe(201)
  })

  it('short links are gone', async () => {
    expect((await post('/links', { query: 'a=cola:1' })).status).toBe(404)
  })
})

describe('client key (the code the real server uses)', () => {
  it('ignores X-Forwarded-For unless a trusted proxy is configured', () => {
    expect(clientKeyFrom('6.6.6.6', '1.2.3.4', false)).toBe('1.2.3.4')
  })
  it('behind a trusted proxy, uses the right-most hop — the left ones can be faked by the client', () => {
    expect(clientKeyFrom('6.6.6.6, 9.9.9.9', '10.0.0.1', true)).toBe('9.9.9.9')
    expect(clientKeyFrom('9.9.9.9', '10.0.0.1', true)).toBe('9.9.9.9')
    expect(clientKeyFrom(undefined, '10.0.0.1', true)).toBe('10.0.0.1')
  })
})

describe('rate limiter memory', () => {
  it('stops growing once full: new clients share one bucket (still limited), and it resets each minute', () => {
    let now = 0
    const allow = rateLimiter(3, () => now)
    for (let i = 0; i < 5000; i++) expect(allow(`c${i}`)).toBe(true)
    // Overflow clients share a bucket of the same limit…
    expect([allow('x1'), allow('x2'), allow('x3'), allow('x4')]).toEqual([true, true, true, false])
    // …while clients already tracked keep their own allowance.
    expect(allow('c1')).toBe(true)
    now = 60_000
    expect(allow('x4')).toBe(true)
  })
})

it('health check', async () => {
  expect(await (await app.request('/api/health')).json()).toEqual({ ok: true })
})
