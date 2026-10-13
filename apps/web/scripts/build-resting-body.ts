// Writes src/assets/resting-body.svg, the picture on Home (src/flat/restingBody.ts). Run by hand
// after a change to the flat body's drawing (restingBody.test.ts says when):
//   npm run resting-body -w @lifepeek/web
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restingBodySvg } from '../src/flat/restingBody.ts'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'resting-body.svg')
fs.writeFileSync(out, restingBodySvg())
console.log(`Wrote ${path.relative(process.cwd(), out)}`)
