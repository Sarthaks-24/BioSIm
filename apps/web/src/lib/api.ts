/**
 * The only place the web app talks to the API, which just receives "report a mistake" messages.
 *
 * In production there is no API (VITE_API_URL is empty): the report opens as a pre-filled GitHub
 * issue in a new tab and nothing is sent anywhere until the user submits it there. With an API,
 * reports are POSTed, and if that fails the same GitHub issue is offered, so nothing typed is lost.
 */
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')
/** True only when an API address is set at build time (local development). */
export const HAS_API = Boolean(API_URL)
const ISSUES_URL = (import.meta.env.VITE_ISSUES_URL as string | undefined) || 'https://github.com/Sarthaks-24/lifepeek/issues/new'

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
    const res = await fetch(`${API_URL}/feedback`, {
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

/**
 * The template's public warning (.github/ISSUE_TEMPLATE/mistake.md). A `body=` in the link replaces
 * the template's text, so the warning is put back at the top: hidden once posted, seen while typing.
 */
const PUBLIC_WARNING = `<!--
Issues are public. Don't write your name, school, phone number, email or any health information.
-->`

/** The report as a GitHub "new issue" link, already filled in (template .github/ISSUE_TEMPLATE/mistake.md). */
export function feedbackIssueUrl(input: FeedbackInput): string {
  const body = [
    PUBLIC_WARNING,
    '',
    `**Where:** ${input.location}`,
    '',
    input.message,
    '',
    input.source ? `**Source:** ${input.source}` : '',
    `**Comparison:** ${window.location.origin}/sim?${input.context}`,
  ].join('\n')
  const params = new URLSearchParams({ template: 'mistake.md', title: `Mistake: ${input.location}`.slice(0, 120), body })
  return `${ISSUES_URL}?${params}`
}
