import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SITE_URL } from '../lib/site.ts'
import { HOME_TITLE, ROUTE_TITLES, pageTitle } from '../lib/routeMeta.ts'

/** The <meta name="…">, <meta property="…"> or <link rel="…"> in <head>, made the first time (`make`). */
function headTag(tag: 'link' | 'meta', key: 'rel' | 'property' | 'name', value: string, make = true) {
  let el = document.head.querySelector<HTMLElement>(`${tag}[${key}="${value}"]`)
  if (!el && make) {
    el = document.createElement(tag)
    el.setAttribute(key, value)
    document.head.append(el)
  }
  return el
}

/**
 * Each page's title (src/lib/routeMeta.ts, T12a), and the one real address of each page for search
 * engines and link previews: the production site plus the path, without the query. Simulator links
 * differ only in their query (the meals), so they all count as the one /sim page, and copies of the
 * app on other hosts point back here. A path that is no page (the not-found page) gets no canonical
 * and noindex, as the built 404.html has (scripts/prerender-head.mjs).
 */
export function useCanonical() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const known = pathname in ROUTE_TITLES
  const key = known ? ROUTE_TITLES[pathname as keyof typeof ROUTE_TITLES] : 'notFound.title'
  const title = key ? pageTitle(t(key)) : HOME_TITLE
  useEffect(() => {
    document.title = title
    const url = SITE_URL + pathname
    if (known) {
      headTag('link', 'rel', 'canonical')!.setAttribute('href', url)
      headTag('meta', 'property', 'og:url')!.setAttribute('content', url)
      headTag('meta', 'name', 'robots', false)?.remove()
    } else {
      headTag('link', 'rel', 'canonical', false)?.remove()
      headTag('meta', 'property', 'og:url', false)?.remove()
      headTag('meta', 'name', 'robots')!.setAttribute('content', 'noindex')
    }
  }, [pathname, known, title])
}
