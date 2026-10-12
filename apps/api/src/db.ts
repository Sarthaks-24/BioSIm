import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Two tables, no user accounts, no personal data required.
 * Local dev uses a SQLite file; production points DATABASE_URL at Turso (libSQL).
 */

export const shortLinks = sqliteTable('short_links', {
  code: text('code').primaryKey(),
  query: text('query').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  hits: integer('hits').notNull().default(0),
})

export const feedback = sqliteTable('feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  location: text('location').notNull(),
  message: text('message').notNull(),
  source: text('source'),
  /** Optional, only if the reporter wants a reply. Never required. */
  email: text('email'),
  /** The share-link query the reporter was looking at, so we can reproduce it. */
  context: text('context').notNull(),
  status: text('status', { enum: ['new', 'checked', 'fixed', 'rejected'] })
    .notNull()
    .default('new'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS short_links (
    code TEXT PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    email TEXT,
    context TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL
  )`,
]

export type Db = LibSQLDatabase

export async function openDb(
  url = process.env.DATABASE_URL ?? 'file:biosim.db',
  authToken = process.env.DATABASE_AUTH_TOKEN,
): Promise<{ db: Db; client: Client }> {
  const client = createClient(authToken ? { url, authToken } : { url })
  // Two small tables: create-if-missing on boot is simpler than a migration tool.
  for (const sql of SCHEMA) await client.execute(sql)
  return { db: drizzle(client), client }
}
