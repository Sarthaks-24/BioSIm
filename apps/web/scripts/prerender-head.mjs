// Per-page heads at build time (T12a, R72): a head-only prerender, no React on the server.
//
// After `vite build` has written dist/index.html, this Vite plugin writes:
//   dist/index.html, dist/<page>/index.html  each page's title, description, canonical, og:* and
//                                            twitter:* (src/lib/routeMeta.ts), and an empty root:
//                                            the app draws the page as before. JSON-LD (WebSite,
//                                            Organization) on "/" only. vercel.json serves them.
//   dist/404.html                            the not-found page with a real 404 status on Vercel:
//                                            noindex, no canonical, and the NotFound page's text in
//                                            the root, so it reads the same before (or without) JS.
//   dist/sitemap.xml, dist/robots.txt        from the same page list and site address, with the
//                                            build date as lastmod.
// The address is the one build constant (scripts/site-url.mjs). Search engines and link previews
// that run no JavaScript get the right head; the app itself sets document.title on every page
// change (hooks/useCanonical.ts). Nothing here reaches any page's JavaScript (size budget), and no
// file here is precached (vite.config.ts globIgnores): offline, the service worker serves the app
// shell for every page, as before.
//
// Privacy: no third party, nothing collected. CSP: JSON-LD is data (type application/ld+json), not
// a script the browser runs; the CSP (vercel.json) is unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTE_DESCRIPTIONS, ROUTE_TITLES, pageTitle } from '../src/lib/routeMeta.ts'
import { englishFor } from './i18n-sections.mjs'
import { REPO_URL } from './site-url.mjs'

const EN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'en.json')

/** The share picture every page uses (public/og-image.png, made by scripts/make-share-images.mjs). */
const OG_IMAGE = '/og-image.png'

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** An i18n key's English text ("nav.teach" → "For teachers"). */
const lookup = (en, key) => key.split('.').reduce((o, k) => o?.[k], en)

/** Every page's path, title and description. */
export function routes(en) {
  return Object.entries(ROUTE_TITLES).map(([route, key]) => {
    const name = key ? lookup(en, key) : ''
    if (key && typeof name !== 'string') throw new Error(`routeMeta: en.json has no ${key}`)
    return { route, title: pageTitle(name), description: ROUTE_DESCRIPTIONS[route] }
  })
}

/** The JSON-LD for "/": the site and who publishes it. */
export function jsonLd(site, description) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: 'LifePeek',
        url: `${site}/`,
        description,
        inLanguage: 'en',
        isAccessibleForFree: true,
        publisher: { '@id': `${site}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'LifePeek',
        url: `${site}/`,
        logo: `${site}/icon-512.png`,
        sameAs: [REPO_URL],
      },
    ],
  }
  // "<" escaped, so no text in it can close the script element.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

/**
 * The built index.html with `head` in place of its title and per-page tags. The template's own
 * <title> and any description, canonical, og:url/title/description/image and twitter:title/
 * description/image tags go; the shared ones (charset, icons, og:type, og:site_name, image size and
 * alt, twitter:card) stay.
 */
export function withHead(template, head) {
  const perPage =
    /\s*<(?:title>[\s\S]*?<\/title|meta\s+name="description"[^>]*|link\s+rel="canonical"[^>]*|meta\s+name="robots"[^>]*|meta\s+property="og:(?:url|title|description|image)"[^>]*|meta\s+name="twitter:(?:title|description|image)"[^>]*|script\s+type="application\/ld\+json">[\s\S]*?<\/script)>/g
  const html = template.replace(perPage, '')
  if (!html.includes('</head>')) throw new Error('prerender-head: no </head> in index.html')
  return html.replace('</head>', `\n${head}\n  </head>`)
}

/** The head tags of one page. */
export function pageHead(site, { route, title, description }) {
  const url = site + route
  const image = site + OG_IMAGE
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:image" content="${escape(image)}" />`,
    `<meta name="twitter:title" content="${escape(title)}" />`,
    `<meta name="twitter:description" content="${escape(description)}" />`,
    `<meta name="twitter:image" content="${escape(image)}" />`,
  ]
  if (route === '/') tags.push(jsonLd(site, description))
  return tags.map((t) => `    ${t}`).join('\n')
}

/**
 * The not-found page: noindex, no canonical (it is no page's address), and the NotFound page's
 * words and links (pages/Misc.tsx, same classes) in the root, so it matches before the app draws
 * and without JavaScript. The app then draws NotFound in the same place, with the header and footer.
 */
export function notFoundHtml(template, en) {
  const nf = en.notFound
  const head = [`<title>${escape(pageTitle(nf.title))}</title>`, '<meta name="robots" content="noindex" />']
    .map((t) => `    ${t}`)
    .join('\n')
  const body = [
    '<div class="mx-auto px-4 max-w-xl py-20 text-center">',
    `<h1 class="text-3xl font-extrabold">${escape(nf.title)}</h1>`,
    `<p class="mt-3 text-ink-muted">${escape(nf.body)}</p>`,
    '<p class="mt-6 flex flex-wrap justify-center gap-3">',
    `<a href="/sim" class="inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-white">${escape(nf.cta)}</a>`,
    `<a href="/" class="inline-block rounded-full border border-border px-5 py-2.5 font-semibold">${escape(nf.home)}</a>`,
    '</p>',
    '</div>',
  ].join('')
  const html = withHead(template, head)
  if (!html.includes('<div id="root"></div>')) throw new Error('prerender-head: no empty <div id="root"> in index.html')
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

/** sitemap.xml: every page, with the build date as lastmod (YYYY-MM-DD). */
export function sitemap(site, pages, date) {
  const urls = pages.map((p) => `  <url><loc>${escape(site + p.route)}</loc><lastmod>${date}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export const robots = (site) => `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`

/** The file a page's HTML is written to, under dist ("/" → index.html, "/teach" → teach/index.html). */
export const htmlFile = (route) => (route === '/' ? 'index.html' : `${route.slice(1)}/index.html`)

/** The Vite plugin. `site`: the production address (scripts/site-url.mjs). */
export default function prerenderHead({ site }) {
  let hindi = false
  return {
    name: 'lifepeek-prerender-head',
    apply: 'build',
    configResolved(config) {
      hindi = config.env.VITE_HINDI === '1'
    },
    writeBundle(options) {
      const dir = options.dir
      const template = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
      const en = englishFor(JSON.parse(fs.readFileSync(EN, 'utf8')), hindi)
      const pages = routes(en)
      for (const page of pages) {
        const file = path.join(dir, htmlFile(page.route))
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, withHead(template, pageHead(site, page)))
      }
      fs.writeFileSync(path.join(dir, '404.html'), notFoundHtml(template, en))
      fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemap(site, pages, new Date().toISOString().slice(0, 10)))
      fs.writeFileSync(path.join(dir, 'robots.txt'), robots(site))
    },
  }
}
