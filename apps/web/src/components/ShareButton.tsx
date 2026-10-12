import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSim, shareSearch } from '../state/sim.ts'
import { createShortLink } from '../lib/api.ts'

/** Copies a link that reopens this exact comparison. Uses a short link when the API is up. */
export default function ShareButton() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const share = async () => {
    const query = shareSearch(useSim.getState())
    const long = `${window.location.origin}/sim?${query}`
    const code = await createShortLink(query)
    const url = code ? `${window.location.origin}/s/${code}` : long
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <button type="button" onClick={share} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold hover:bg-sunk">
      <span aria-live="polite">
        {status === 'copied' ? t('sim.shareCopied') : status === 'failed' ? t('sim.shareFailed') : t('sim.share')}
      </span>
    </button>
  )
}
