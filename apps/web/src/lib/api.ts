/**
 * The only place the web app talks to the API, which just receives "report a mistake" messages.
 * If the API is down or not deployed, reports go through a pre-filled GitHub issue instead, so
 * nothing the user typed is lost.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api'
const ISSUES_URL = (import.meta.env.VITE_ISSUES_URL as string | undefined) ?? 'https://github.com/Sarthaks-24/BioSIm/issues/new'

export interface FeedbackInput {
  location: string
  message: string
  source?: string
  /** The comparison being viewed (share-link query), so the report can be reproduced. */
  context: string
}

export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(`${BASE}/feedback`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Fallback: open a GitHub issue with the report already filled in. */
export function feedbackIssueUrl(input: FeedbackInput): string {
  const body = [
    `**Where:** ${input.location}`,
    '',
    input.message,
    '',
    input.source ? `**Source:** ${input.source}` : '',
    `**Comparison:** ${window.location.origin}/sim?${input.context}`,
  ].join('\n')
  const params = new URLSearchParams({ title: `Mistake: ${input.location}`.slice(0, 120), body })
  return `${ISSUES_URL}?${params}`
}
