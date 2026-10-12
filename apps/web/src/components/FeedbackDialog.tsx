import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { feedbackIssueUrl, sendFeedback, type FeedbackInput } from '../lib/api.ts'
import { useSim, shareQuery } from '../state/sim.ts'

/**
 * "Report a mistake" — the credibility loop. No email or other personal data is asked for.
 * If the server can't be reached, the same report opens as a pre-filled GitHub issue, so
 * nothing typed is lost.
 */
export default function FeedbackDialog() {
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
      context: shareQuery(useSim.getState()),
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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus('idle')
          ref.current?.showModal()
        }}
        className="text-sm font-semibold underline underline-offset-4"
      >
        {t('sim.reportError')}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="fb-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-panel p-0 text-ink backdrop:bg-ink/40"
      >
        <form onSubmit={submit} className="space-y-3 p-5">
          <h2 id="fb-title" className="text-xl font-extrabold">
            {t('feedback.title')}
          </h2>
          <p className="text-sm text-ink-2">{t('feedback.intro')}</p>
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
          <p className="text-xs text-ink-2">{t('feedback.privacy')}</p>
          <div role="status" className="text-sm font-semibold">
            {status === 'sent' && t('feedback.sent')}
            {status === 'failed' && (
              <p>
                {t('feedback.failed')}{' '}
                <a href={fallback} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  {t('feedback.openIssue')}
                </a>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-full px-4 py-2 font-semibold hover:bg-sunk">
              {t('feedback.close')}
            </button>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-full bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {t('feedback.send')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
