import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSim, shareQuery } from '../state/sim.ts'

/**
 * Share this exact comparison. Uses the phone's share sheet (WhatsApp etc.) when there is one,
 * otherwise copies the link — synchronously inside the click, so browsers allow it. If copying
 * is blocked, the link is shown so it can be copied by hand.
 */
export default function ShareButton() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [url, setUrl] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const share = () => {
    const link = `${window.location.origin}/sim?${shareQuery(useSim.getState(), i18n.language)}`
    setUrl(link)
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: 'LifePeek', url: link }).catch(() => undefined)
      return
    }
    const copy = navigator.clipboard?.writeText(link)
    if (!copy) {
      setStatus('manual')
      return
    }
    copy.then(
      () => {
        setStatus('copied')
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus('idle'), 2500)
      },
      () => setStatus('manual'),
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={share} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold hover:bg-sunk">
        <span aria-live="polite">{status === 'copied' ? t('sim.shareCopied') : t('sim.share')}</span>
      </button>
      {status === 'manual' && (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">{t('sim.shareManual')}</span>
          <input
            readOnly
            value={url}
            autoFocus
            onFocus={(e) => e.target.select()}
            className="w-56 rounded-lg border border-rule bg-white px-2 py-1.5 text-sm"
          />
        </label>
      )}
    </div>
  )
}
