/**
 * The only place the web app talks to the API. Every call is optional: if the API is down or
 * not deployed, the app keeps working (long share links, feedback falls back to an error).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Returns a short code for a comparison, e.g. "k3x9pq", or null if the API is unavailable. */
export async function createShortLink(query: string): Promise<string | null> {
  try {
    const { code } = await request<{ code: string }>('/links', { method: 'POST', body: JSON.stringify({ query }) })
    return code
  } catch {
    return null
  }
}

export async function resolveShortLink(code: string): Promise<string | null> {
  try {
    const { query } = await request<{ query: string }>(`/links/${encodeURIComponent(code)}`)
    return query
  } catch {
    return null
  }
}

export interface FeedbackInput {
  location: string
  message: string
  source?: string
  email?: string
  context: string
}

export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
  try {
    await request('/feedback', { method: 'POST', body: JSON.stringify(input) })
    return true
  } catch {
    return false
  }
}
