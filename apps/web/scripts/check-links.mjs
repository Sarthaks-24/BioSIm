// Link check of a finished build (T12b, R72), no dependency: run after `npm run build`.
//
//   npm run links -w @lifepeek/web                 the built site, offline (CI): exits 1 on a broken link
//   npm run links -w @lifepeek/web -- --external   also asks every outside address the app links to
//
// A path is resolved as Vercel serves dist (vercel.json): a file, a rewrite to a page's built HTML,
// or the redirect; anything else is a 404. Checked:
// - every href and src in the built HTML pages and 404.html;
// - each page's canonical, og:url, og:image and twitter:image: the one site address, and a page or file;
// - each page's head: its own title and description, one canonical; 404.html noindex without canonical;
// - sitemap.xml (every address a page whose canonical it is) and robots.txt;
// - the manifest's icons, screenshots, shortcuts and start_url;
// - the router links and plain links compiled into the app's code (`to:"/teach"`, `href:"/…"`).
// --external (needs the internet, report it by hand; not in CI): the outside addresses in the app's
// text, food files and references, HEAD then GET. FoodData Central answers 404 to scripts while the
// page works in a browser (its shell is served with a 404 status), and doi.org answers 403 to
// scripts: both are allowed (web audit, 2026-10-14).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(web, '..', '..')
const dist = path.join(web, process.argv.find((a) => a.startsWith('--dist='))?.slice(7) ?? 'dist')
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const problems = []
const fail = (where, what) => problems.push(`${where}: ${what}`)

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`No ${path.relative(process.cwd(), dist)}/index.html. Run the build first.`)
  process.exit(1)
}

const isFile = (rel) => fs.existsSync(path.join(dist, rel)) && fs.statSync(path.join(dist, rel)).isFile()

/** What Vercel answers for a path: 200 (with the file), 301 (with where), or 404. */
function resolve(urlPath) {
  const p = decodeURI(urlPath.split(/[?#]/)[0])
  if (p === '/') return { status: 200, file: 'index.html' }
  if (isFile(p.slice(1))) return { status: 200, file: p.slice(1) }
  const redirect = (vercel.redirects ?? []).find((r) => r.source === p)
  if (redirect) return { status: redirect.statusCode ?? 308, to: redirect.destination }
  const rewrite = (vercel.rewrites ?? []).find((r) => r.source === p)
  if (rewrite && isFile(rewrite.destination.slice(1))) return { status: 200, file: rewrite.destination.slice(1) }
  return { status: 404 }
}

/** A local path that must work: 200, or a redirect to one that does. */
function checkPath(where, urlPath) {
  let r = resolve(urlPath)
  if (r.status === 301 || r.status === 308) r = resolve(r.to)
  if (r.status !== 200) fail(where, `${urlPath} is a ${r.status}`)
  const hash = urlPath.split('#')[1]
  // An anchor on a page the app draws (/about#licences) is checked in the browser (e2e), not here.
  return { ...r, hash }
}

const read = (rel) => fs.readFileSync(path.join(dist, rel), 'utf8')
const attr = (html, re) => [...html.matchAll(re)].map((m) => m[1])

// The pages: index.html and every <page>/index.html, and 404.html.
const pages = [
  'index.html',
  ...fs
    .readdirSync(dist)
    .filter((d) => isFile(`${d}/index.html`) && d !== 'assets')
    .map((d) => `${d}/index.html`),
]
const canonical = (html) => attr(html, /<link rel="canonical" href="([^"]+)"/g)
const site = canonical(read('index.html'))[0]?.replace(/\/$/, '')
if (!site) fail('index.html', 'no canonical')

const seen = { title: new Map(), description: new Map() }
for (const file of [...pages, '404.html']) {
  if (!isFile(file)) {
    fail(file, 'missing')
    continue
  }
  const html = read(file)
  for (const url of attr(html, /\s(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(url)) continue
    checkPath(file, url.startsWith('/') ? url : `/${path.posix.join(path.posix.dirname(file), url)}`)
  }
  const titles = attr(html, /<title>([^<]*)<\/title>/g)
  if (titles.length !== 1) fail(file, `${titles.length} titles`)
  if (file === '404.html') {
    if (!html.includes('<meta name="robots" content="noindex" />')) fail(file, 'no noindex')
    if (canonical(html).length) fail(file, 'has a canonical')
    continue
  }
  const descriptions = attr(html, /<meta name="description" content="([^"]*)"/g)
  if (descriptions.length !== 1) fail(file, `${descriptions.length} descriptions`)
  for (const [kind, value] of [
    ['title', titles[0]],
    ['description', descriptions[0]],
  ]) {
    if (seen[kind].has(value)) fail(file, `same ${kind} as ${seen[kind].get(value)}`)
    seen[kind].set(value, file)
  }
  const route = file === 'index.html' ? '/' : `/${path.posix.dirname(file)}`
  const canon = canonical(html)
  if (canon.length !== 1 || canon[0] !== site + route) fail(file, `canonical ${canon.join(', ') || 'missing'}, expected ${site + route}`)
  const absolute = attr(html, /<meta (?:property|name)="(?:og:url|og:image|twitter:image)" content="([^"]+)"/g)
  if (absolute.length !== 3) fail(file, `${absolute.length} of og:url, og:image, twitter:image`)
  for (const url of absolute) {
    if (!url.startsWith(`${site}/`)) fail(file, `${url} is not on ${site}`)
    else checkPath(file, url.slice(site.length))
  }
  if (html.includes('application/ld+json') !== (route === '/')) fail(file, 'JSON-LD belongs on "/" only')
}

// sitemap.xml and robots.txt
const sitemap = isFile('sitemap.xml') ? read('sitemap.xml') : ''
const locs = attr(sitemap, /<loc>([^<]+)<\/loc>/g)
if (!locs.length) fail('sitemap.xml', 'missing or empty')
if (attr(sitemap, /<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g).length !== locs.length) fail('sitemap.xml', 'a URL without lastmod')
for (const loc of locs) {
  if (!loc.startsWith(site)) fail('sitemap.xml', `${loc} is not on ${site}`)
  const r = checkPath('sitemap.xml', loc.slice(site.length) || '/')
  if (r.file && !canonical(read(r.file)).includes(loc)) fail('sitemap.xml', `${loc}: its page's canonical differs`)
}
if (locs.length !== pages.length) fail('sitemap.xml', `${locs.length} URLs for ${pages.length} pages`)
const robots = isFile('robots.txt') ? read('robots.txt') : ''
if (!robots.includes(`Sitemap: ${site}/sitemap.xml`)) fail('robots.txt', 'no Sitemap line for this site')

// The web app manifest
const manifest = JSON.parse(read('manifest.webmanifest'))
for (const url of [
  manifest.start_url,
  ...(manifest.icons ?? []).map((i) => i.src),
  ...(manifest.screenshots ?? []).map((s) => s.src),
  ...(manifest.shortcuts ?? []).flatMap((s) => [s.url, ...(s.icons ?? []).map((i) => i.src)]),
])
  checkPath('manifest.webmanifest', url)

// Links compiled into the app's code: router links (to) and plain links (href) to a local path.
let codeLinks = 0
for (const file of fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js'))) {
  for (const m of read(`assets/${file}`).matchAll(/\b(?:to|href):\s*(["'`])(\/[^"'`$]*)\1/g)) {
    codeLinks++
    checkPath(`assets/${file}`, m[2])
  }
}
if (!codeLinks) fail('assets', 'no links found in the code (has the build output changed?)')

// Outside addresses (--external).
if (process.argv.includes('--external')) {
  const ALLOWED = [
    { host: 'fdc.nal.usda.gov', status: 404, why: 'FoodData Central serves its page shell with a 404 status; it works in a browser' },
    { host: 'doi.org', status: 403, why: 'doi.org refuses scripts; it works in a browser' },
  ]
  const sources = [
    path.join(web, 'src', 'i18n', 'en.json'),
    path.join(web, 'src', 'lib', 'references.ts'),
    path.join(web, 'src', 'lib', 'credits.ts'),
    path.join(web, 'scripts', 'site-url.mjs'),
    ...fs.readdirSync(path.join(root, 'content', 'foods')).map((f) => path.join(root, 'content', 'foods', f)),
  ]
  const urls = new Set()
  for (const file of sources)
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s"'`)<>,]*[^\s"'`)<>,.;:!?]/g)) urls.add(m[0])
  urls.delete('https://schema.org')
  console.log(`Asking ${urls.size} outside addresses…`)
  for (const url of [...urls].sort()) {
    let status = 0
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(url, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
          headers: { 'user-agent': 'lifepeek-link-check' },
        })
        status = res.status
        if (res.ok) break
      } catch (e) {
        status = `${e.name}`
      }
    }
    if (status === 200 || (typeof status === 'number' && status < 400)) continue
    const allowed = ALLOWED.find((a) => new URL(url).host === a.host && a.status === status)
    if (allowed) console.log(`  allowed ${status} ${url} (${allowed.why})`)
    else fail('outside', `${url} answers ${status}`)
  }
}

const checked = `${pages.length} pages, 404.html, sitemap, robots.txt, manifest, ${codeLinks} links in the code`
if (problems.length) {
  console.error(`Broken links (${checked}):\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`Links ok: ${checked}${process.argv.includes('--external') ? ', outside addresses' : ''}.`)
