import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HAS_API, feedbackIssueUrl, sendFeedback, type FeedbackInput } from '../lib/api.ts'
import { addEnglish } from '../i18n/index.ts'
import feedbackText from 'virtual:lifepeek-en/feedback'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(feedbackText)

/**
 * "Report a mistake" — the credibility loop. No email or other personal data is asked for.
 * Without an API (production) the report opens straight away as a pre-filled GitHub issue in a
 * new tab, and nothing is sent until the user submits it there. With an API it is POSTed, and if
 * that fails the same GitHub issue is offered, so nothing typed is lost. Either way the dialog
 * warns that GitHub issues are public.
 *
 * Used by the stage (a button in the meal bar, `trigger`). It is given the run as a link query
 * (`context`), so the form needs no store.
 */
export default function FeedbackDialog({
  context,
  trigger,
  openOnMount = false,
}: {
  /** The run being viewed, as a link query ("v=2&a=cola:1…"), so the report can be reproduced. */
  context: () => string
  /** The button that opens the form, given the function that opens it. */
  trigger: (open: () => void) => ReactNode
  /** Open the form as soon as it mounts (the stage loads it on the first click). */
  openOnMount?: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [fallback, setFallback] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const input: FeedbackInput = {
      location: String(form.get('location') ?? ''),
      message: String(form.get('message') ?? ''),
      source: String(form.get('source') ?? '') || undefined,
      context: context(),
    }
    if (!HAS_API) {
      window.open(feedbackIssueUrl(input), '_blank', 'noopener')
      return
    }
    setStatus('sending')
    const ok = await sendFeedback(input)
    if (ok) {
      setStatus('sent')
      formEl.reset()
    } else {
      setFallback(feedbackIssueUrl(input))
      setStatus('failed')
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-rule bg-white px-3 py-2'
  const warning = <p className="text-xs font-semibold text-ink">{t('feedback.publicWarning')}</p>

  const open = () => {
    setStatus('idle')
    ref.current?.showModal()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  useEffect(() => void (openOnMount && open()), [])
  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        aria-labelledby="fb-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-surface-raised p-0 text-ink backdrop:bg-ink/40"
      >
        <form onSubmit={submit} className="space-y-3 p-5">
          <h2 id="fb-title" className="text-xl font-extrabold">
            {t('feedback.title')}
          </h2>
          <p className="text-sm text-ink-muted">{t('feedback.intro')}</p>
          <label className="block text-sm font-semibold">
            {t('feedback.where')}
            <input name="location" required maxLength={200} className={field} />
          </label>
          <label className="block text-sm font-semibold">
            {t('feedback.message')}
            <textarea name="message" required minLength={10} maxLength={2000} rows={4} className={field} />
          </label>
          <label className="block text-sm font-semibold">
            {t('feedback.source')}
            <input name="source" maxLength={500} className={field} />
          </label>
          <p className="text-xs text-ink-muted">{t('feedback.privacy')}</p>
          {!HAS_API && warning}
          <div role="status" className="text-sm font-semibold">
            {status === 'sent' && t('feedback.sent')}
            {status === 'failed' && (
              <div className="space-y-1">
                <p>
                  {t('feedback.failed')}{' '}
                  <a href={fallback} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    {t('feedback.openIssue')}
                  </a>
                </p>
                {warning}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-full px-4 py-2 font-semibold hover:bg-sunk">
              {t('feedback.close')}
            </button>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-full bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {HAS_API ? t('feedback.send') : t('feedback.openIssueDirect')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
