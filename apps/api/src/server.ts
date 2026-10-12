import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

// Settings come from apps/api/.env (loaded by `tsx --env-file`) or the host's environment.
const port = Number(process.env.PORT ?? 8787)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim())
const trustProxy = process.env.TRUST_PROXY === '1'
const adminToken = process.env.ADMIN_TOKEN || undefined
const dbUrl = process.env.DATABASE_URL ?? 'file:biosim.db'

/** Socket address by default; the forwarded header only when we're told a trusted proxy sets it. */
function clientKey(c: Context): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  return getConnInfo(c).remote.address ?? 'unknown'
}

const { db } = await openDb(dbUrl)
const app = createApp({ db, allowedOrigins, adminToken, clientKey })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BioSim API on http://localhost:${info.port}/api/health`)
  console.log(`  database:        ${dbUrl.startsWith('file:') ? dbUrl : dbUrl.replace(/\/\/.*@/, '//***@')}`)
  console.log(`  allowed origins: ${allowedOrigins.join(', ')}`)
  console.log(`  trust proxy:     ${trustProxy ? 'yes (X-Forwarded-For)' : 'no (socket address)'}`)
  console.log(`  reading reports: ${adminToken ? 'enabled (ADMIN_TOKEN set)' : 'disabled — set ADMIN_TOKEN to enable'}`)
})
