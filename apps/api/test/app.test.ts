import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'

let app: ReturnType<typeof createApp>

beforeEach(async () => {
  const { db } = await openDb(':memory:')
  app = createApp({ db, allowedOrigins: ['http://localhost:5173'], adminToken: 'secret', writeLimitPerMinute: 5 })
})

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/api${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })

describe('short links', () => {
  it('creates a code and resolves it to the canonical query', async () => {
    const res = await post('/links', { query: 'a=cola:1&b=cheeseburger:1,fries:1' })
    expect(res.status).toBe(201)
    const { code } = (await res.json()) as { code: string }
    expect(code).toMatch(/^[a-z2-9]{7}$/)

    const got = await app.request(`/api/links/${code}`)
    expect(got.status).toBe(200)
    const { query } = (await got.json()) as { query: string }
    expect(query).toContain('a=cola%3A1')
    expect(query).toContain('v=')
  })

  it('reuses the same code for the same comparison', async () => {
    const a = (await (await post('/links', { query: 'a=cola:1&b=water:1' })).json()) as { code: string }
    const b = (await (await post('/links', { query: 'v=1&a=cola:1&b=water:1' })).json()) as { code: string }
    expect(b.code).toBe(a.code)
  })

  it('rejects links without meals and junk input', async () => {
    expect((await post('/links', { query: 't=5' })).status).toBe(400)
    expect((await post('/links', { nope: 1 })).status).toBe(400)
    expect((await app.request('/api/links/NOT_VALID!')).status).toBe(404)
    expect((await app.request('/api/links/abcdefg')).status).toBe(404)
  })
})

describe('feedback', () => {
  const report = { location: 'Stomach panel', message: 'The pepsin sentence should mention pH.', context: 'a=cola:1' }

  it('accepts a report without email and hides the list without a token', async () => {
    expect((await post('/feedback', report)).status).toBe(201)
    expect((await app.request('/api/feedback')).status).toBe(401)
    const res = await app.request('/api/feedback', { headers: { authorization: 'Bearer secret' } })
    const { items } = (await res.json()) as { items: { message: string; email: string | null }[] }
    expect(items).toHaveLength(1)
    expect(items[0]!.email).toBeNull()
  })

  it('validates input', async () => {
    expect((await post('/feedback', { ...report, message: 'short' })).status).toBe(400)
    expect((await post('/feedback', { ...report, email: 'not-an-email' })).status).toBe(400)
  })

  it('rate limits writes per client', async () => {
    const statuses = []
    for (let i = 0; i < 7; i++) statuses.push((await post('/feedback', report, { 'x-forwarded-for': '1.2.3.4' })).status)
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})

it('health check', async () => {
  expect(await (await app.request('/api/health')).json()).toEqual({ ok: true })
})
