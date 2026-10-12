// Checks that every Workbox module shipped in the service worker is in the notices file. Run
// after `npm run build` (CI does):
//   node apps/web/scripts/check-shipped-notices.mjs
// Each Workbox module stamps itself as `workbox:<module>:<version>` in dist/workbox-*.js; for
// each one, dist/THIRD_PARTY_NOTICES.txt must have a `workbox-<module> <version>` heading. The
// stamp lags the package's patch number (7.4.1 says 7.4.0), so major.minor must match. A module
// the service worker starts using later then fails here until third-party-notices.mjs lists it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const lines = fs.readFileSync(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8').split('\n')

const shipped = new Map()
for (const file of fs.readdirSync(dist).filter((f) => /^(workbox-.*|sw)\.js$/.test(f))) {
  for (const [, mod, version] of fs.readFileSync(path.join(dist, file), 'utf8').matchAll(/workbox:([a-z-]+):(\d+\.\d+\.\d+)/g)) {
    shipped.set(mod, version)
  }
}

const problems = []
if (shipped.size === 0) problems.push('no workbox:<module>:<version> stamps found in dist/workbox-*.js or dist/sw.js')
for (const [mod, version] of shipped) {
  const minor = version.split('.').slice(0, 2).join('.')
  const listed = lines.some((l) => l.startsWith(`workbox-${mod} ${minor}.`))
  if (!listed) problems.push(`workbox-${mod} ${version} ships in the service worker but is not in THIRD_PARTY_NOTICES.txt`)
}

for (const [mod, version] of shipped)
  console.log(`workbox-${mod} ${version}: ${problems.some((p) => p.includes(`workbox-${mod} `)) ? 'MISSING' : 'listed'}`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
