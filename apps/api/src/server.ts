import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

const port = Number(process.env.PORT ?? 8787)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim())

const { db } = await openDb()
const app = createApp({ db, allowedOrigins, adminToken: process.env.ADMIN_TOKEN })

serve({ fetch: app.fetch, port }, (info) => console.log(`BioSim API on http://localhost:${info.port}/api/health`))
