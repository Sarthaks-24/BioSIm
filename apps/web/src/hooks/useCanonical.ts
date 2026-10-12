import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { SITE_URL } from '../lib/site.ts'

/** Sets <meta property="…"> or <link rel="…"> in <head>, creating it the first time. */
function headTag(tag: 'link' | 'meta', key: 'rel' | 'property', value: string): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(`${tag}[${key}="${value}"]`)
  if (!el) {
    el = document.createElement(tag)
    el.setAttribute(key, value)
    document.head.append(el)
  }
  return el
}

/**
 * Points search engines and link previews at the one real address of each page: the production
 * site plus the path, without the query. Simulator links differ only in their query (the meals),
 * so they all count as the one /sim page, and copies of the app on other hosts point back here.
 */
export function useCanonical() {
  const { pathname } = useLocation()
  useEffect(() => {
    const url = SITE_URL + pathname
    headTag('link', 'rel', 'canonical').setAttribute('href', url)
    headTag('meta', 'property', 'og:url').setAttribute('content', url)
  }, [pathname])
}
