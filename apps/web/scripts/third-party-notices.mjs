// Writes public/THIRD_PARTY_NOTICES.txt: the licence text of every npm package the web app ships.
// Usage (from apps/web):  node scripts/third-party-notices.mjs          -> write the file
//                         node scripts/third-party-notices.mjs --check  -> also fail on a bad licence
// It walks the production dependency tree of apps/web/package.json. That can list a few packages
// the bundler later tree-shakes away; listing extra notices is harmless, missing one is not.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webDir = process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : path.resolve(here, '..')
const outFile = process.env.OUT_FILE
  ? path.resolve(process.env.OUT_FILE)
  : path.join(webDir, 'public', 'THIRD_PARTY_NOTICES.txt')
const CHECK = process.argv.includes('--check')

// Licences that are fine to ship in an Apache-2.0 app. Anything else stops the build in --check mode.
const ALLOWED = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'OFL-1.1', 'CC0-1.0', 'Zlib'])
// Packages without a "license" field whose LICENSE file was checked by hand.
const KNOWN = { 'webgl-constants': 'MIT' }
const author = (pkg) => (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name) || `the ${pkg.name} authors`
const FALLBACK = {
  MIT: (pkg) => `MIT License (standard text; the package ships no LICENSE file)

Copyright (c) ${author(pkg)}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  'Apache-2.0': (pkg) => `Copyright ${author(pkg)}. Licensed under the Apache License, Version 2.0
(the package ships no LICENSE file; the full licence text is at the end of this file).`,
}
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i

const seen = new Map() // real path -> info
const problems = []

function findPackage(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const pj = path.join(dir, 'node_modules', name, 'package.json')
    if (fs.existsSync(pj)) return pj
    if (path.dirname(dir) === dir) return null
  }
}

function walk(name, fromDir) {
  const pj = findPackage(name, fromDir)
  if (!pj) return // optional dependency not installed on this platform
  const root = fs.realpathSync(path.dirname(pj))
  if (seen.has(root)) return
  const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'))
  const own = pkg.name.startsWith('@lifepeek/')
  const license = pkg.license ?? KNOWN[pkg.name] ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(' OR ') : 'UNKNOWN')
  const files = fs.readdirSync(root).filter((f) => LICENSE_FILE.test(f)).sort()
  const texts = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8').trim())
  if (texts.length === 0 && FALLBACK[license]) texts.push(FALLBACK[license](pkg))
  seen.set(root, { name: pkg.name, version: pkg.version, license, texts, own, repo: pkg.homepage ?? pkg.repository?.url ?? pkg.repository })
  if (!own) {
    const ok = license.split(/\s+OR\s+|[()]/).map((s) => s.trim()).filter(Boolean).some((l) => ALLOWED.has(l))
    if (!ok) problems.push(`${pkg.name}@${pkg.version}: licence "${license}" is not on the allow-list`)
    // No LICENSE file in the package: fine for MIT and Apache-2.0 (standard text added below),
    // anything else needs a human to add the text.
    if (texts.length === 0 && !FALLBACK[license]) problems.push(`${pkg.name}@${pkg.version}: no LICENSE file found (add the text by hand)`)
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep, root)
}

const webPkg = JSON.parse(fs.readFileSync(path.join(webDir, 'package.json'), 'utf8'))
for (const dep of Object.keys(webPkg.dependencies ?? {})) walk(dep, webDir)

const pkgs = [...seen.values()].filter((p) => !p.own).sort((a, b) => a.name.localeCompare(b.name))
const rule = '-'.repeat(78)
const out = [
  'LifePeek: third-party notices',
  '',
  'LifePeek itself is Apache-2.0 (code) and CC BY 4.0 (content); see LICENSE, NOTICE and',
  'LICENSE-CONTENT.md in the source repository. It ships the following third-party software',
  'and fonts. Their licences require these notices to be kept.',
  '',
  `Packages: ${pkgs.length}`,
  '',
  ...pkgs.flatMap((p) => [
    rule,
    `${p.name} ${p.version}`,
    `License: ${p.license}`,
    ...(p.repo ? [`Source: ${p.repo}`] : []),
    '',
    ...(p.texts.length ? p.texts.flatMap((t) => [t, '']) : ['(No licence file in the package. See the licence named above.)', '']),
  ]),
  rule,
  'Apache License, Version 2.0 (full text, for the Apache-2.0 packages above)',
  '',
  apacheText(),
  '',
].join('\n')

function apacheText() {
  const repoLicense = path.resolve(webDir, '..', '..', 'LICENSE')
  const text = fs.existsSync(repoLicense) ? fs.readFileSync(repoLicense, 'utf8') : ''
  if (/Apache License\s+Version 2\.0/.test(text)) return text.trim()
  problems.push('repo-root LICENSE with the Apache-2.0 text not found')
  return 'See https://www.apache.org/licenses/LICENSE-2.0.txt'
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, out)
console.log(`third-party notices: ${pkgs.length} packages -> ${path.relative(process.cwd(), outFile)}`)

if (CHECK) {
  if (!/SIL OPEN FONT LICENSE/i.test(out)) problems.push('SIL Open Font License text for the fonts is missing')
  if (problems.length) {
    console.error('Licence check failed:\n- ' + problems.join('\n- '))
    process.exit(1)
  }
  console.log('licence check: OK')
}
