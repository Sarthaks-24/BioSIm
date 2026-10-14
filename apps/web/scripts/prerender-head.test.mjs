import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { htmlFile, notFoundHtml, pageHead, robots, routes, sitemap, withHead } from './prerender-head.mjs'
import { englishFor } from './i18n-sections.mjs'
import { DEFAULT_SITE_URL, siteUrl } from './site-url.mjs'
import { ROUTE_DESCRIPTIONS, ROUTE_TITLES } from '../src/lib/routeMeta.ts'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const en = englishFor(JSON.parse(fs.readFileSync(path.join(web, 'src', 'i18n', 'en.json'), 'utf8')), false)
const template = fs.readFileSync(path.join(web, 'index.html'), 'utf8')
const SITE = 'https://example.org'
const pages = routes(en)

describe('route-meta table (T12a)', () => {
  it("lists exactly the router's pages (main.tsx), without the redirect and the not-found route", () => {
    const main = fs.readFileSync(path.join(web, 'src', 'main.tsx'), 'utf8')
    const paths = [...main.matchAll(/path: '([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*' && p !== '/next')
    expect(Object.keys(ROUTE_TITLES).sort()).toEqual(paths.sort())
    expect(Object.keys(ROUTE_DESCRIPTIONS).sort()).toEqual(paths.sort())
  })

  it('every page has its own title and description, of a length search results show', () => {
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length)
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length)
    for (const p of pages) {
      expect(p.title.length, p.route).toBeLessThanOrEqual(60)
      expect(p.description.length, p.route).toBeGreaterThanOrEqual(70)
      expect(p.description.length, p.route).toBeLessThanOrEqual(200)
    }
    expect(pages.find((p) => p.route === '/teach')?.title).toBe('For teachers — LifePeek')
  })

  it('the app never carries the descriptions (size budget: only the built HTML has them)', () => {
    const src = path.join(web, 'src')
    const importers = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name) && fs.readFileSync(full, 'utf8').includes('ROUTE_DESCRIPTIONS'))
          importers.push(path.relative(src, full).replace(/\\/g, '/'))
      }
    }
    walk(src)
    expect(importers).toEqual(['lib/routeMeta.ts'])
  })
})

describe('built heads (scripts/prerender-head.mjs)', () => {
  const head = (route) =>
    withHead(
      template,
      pageHead(
        SITE,
        pages.find((p) => p.route === route),
      ),
    )

  it('each page: one title, description, canonical, og and twitter tags, from the one site address', () => {
    for (const p of pages) {
      const html = head(p.route)
      expect(html.match(/<title>/g), p.route).toHaveLength(1)
      expect(html.match(/name="description"/g), p.route).toHaveLength(1)
      expect(html).toContain(`<link rel="canonical" href="${SITE}${p.route}" />`)
      expect(html).toContain(`<meta property="og:url" content="${SITE}${p.route}" />`)
      expect(html).toContain(`<meta property="og:image" content="${SITE}/og-image.png" />`)
      for (const tag of ['og:title', 'og:description', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:card'])
        expect(html.match(new RegExp(`"${tag}"`, 'g')), `${p.route} ${tag}`).toHaveLength(1)
      // An empty root: the app draws the page (no React on the server).
      expect(html).toContain('<div id="root"></div>')
      expect(html).not.toContain('lifepeek.vercel.app')
    }
  })

  it('JSON-LD (WebSite, Organization) on "/" only', () => {
    const home = head('/')
    const ld = JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(['WebSite', 'Organization'])
    expect(ld['@graph'][0].url).toBe(`${SITE}/`)
    for (const p of pages.filter((q) => q.route !== '/')) expect(head(p.route), p.route).not.toContain('ld+json')
  })

  it('a page head replaces a previous one, never adds a second', () => {
    const twice = withHead(head('/'), pageHead(SITE, pages[1]))
    expect(twice.match(/<title>/g)).toHaveLength(1)
    expect(twice.match(/rel="canonical"/g)).toHaveLength(1)
    expect(twice).not.toContain('ld+json')
  })

  it('404.html: noindex, no canonical, and the NotFound page in the root', () => {
    const html = notFoundHtml(template, en)
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('property="og:url"')
    expect(html).toContain(`<title>${en.notFound.title} — LifePeek</title>`)
    expect(html).toContain('<h1 class="text-3xl font-extrabold">Page not found</h1>')
    expect(html).toContain('href="/sim"')
    expect(html).toContain('href="/"')
  })

  it('sitemap: every page with lastmod; robots.txt names it', () => {
    const xml = sitemap(SITE, pages, '2026-10-14')
    for (const p of pages) expect(xml).toContain(`<url><loc>${SITE}${p.route}</loc><lastmod>2026-10-14</lastmod></url>`)
    expect(xml).toContain('/stats</loc>')
    expect(robots(SITE)).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('files: "/" is index.html, a page its folder', () => {
    expect(htmlFile('/')).toBe('index.html')
    expect(htmlFile('/teach')).toBe('teach/index.html')
  })
})

describe('the site address (scripts/site-url.mjs)', () => {
  it('VITE_SITE_URL or the planned name, without a trailing slash; nonsense fails the build', () => {
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(siteUrl('https://lifepeek.example/')).toBe('https://lifepeek.example')
    expect(() => siteUrl('lifepeek.example')).toThrow()
    expect(() => siteUrl('https://a.example/sub')).toThrow()
  })
})
