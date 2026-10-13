// Dead code in the web app (T10 / FP-9, bug B25: the store's `swapKept`, which nothing called).
// A grep, no new dependency: it reads apps/web/src and finds
//   1. exports nothing uses: not another file (app, tests, e2e, scripts), not their own file;
//   2. components (a capitalised function, or a re-export of a .tsx file's default) only tests
//      render: the app never shows them (PersonTag, R60);
//   3. store actions (a function member of a `…State` interface in src/state/) only tests call:
//      the app never runs them (swapKept).
// Names are matched as whole words, so a name used in a comment counts as used: it may miss dead
// code, never flag live code. Part of `npm run check` (exits 1 on any finding).
//
//   node apps/web/scripts/dead-code.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Exports kept on purpose though nothing uses them yet (`<file> <name>`), with why. */
export const KEEP = {
  'registry/types.ts InsideViewDef': 'the registry contract for v3 systems (architecture.md): a system pack fills it in',
}

const isTest = (file) => /\.test\.[cm]?[jt]sx?$/.test(file)
const count = (text, name) => text.match(new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'))?.length ?? 0
const COMPONENT = /^[A-Z][a-z]\w*$/

/**
 * The names a file exports: `{ name, component, target? }`. `component`: a capitalised function, or
 * a re-exported default of a .tsx file; `target`: the file a re-export (`export { x } from './X.tsx'`) points at.
 */
export function exportsOf(text, file) {
  const out = []
  for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm))
    out.push({ name: m[2], component: m[1] === 'function' && COMPONENT.test(m[2]) && file.endsWith('.tsx') })
  for (const m of text.matchAll(/^export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*'([^']+)')?/gm)) {
    const target = m[3]?.startsWith('.') ? path.posix.join(path.posix.dirname(file), m[3]) : undefined
    for (const part of m[2].split(',')) {
      const [from, name = from] = part.trim().split(/\s+as\s+/)
      if (!from) continue
      const type = Boolean(m[1]) || from.startsWith('type ')
      out.push({ name: name.replace(/^type\s+/, ''), target, component: !type && from === 'default' && Boolean(target?.endsWith('.tsx')) && COMPONENT.test(name) })
    }
  }
  return out
}

/** The store actions a state file declares: function members of its exported `…State` interfaces. */
export function actionsOf(text) {
  const out = []
  for (const m of text.matchAll(/^export interface \w*State\b[^{]*\{([\s\S]*?)^\}/gm))
    for (const a of m[1].matchAll(/^ {2}([A-Za-z_$][\w$]*)\??:\s*\(/gm)) out.push(a[1])
  return out
}

/**
 * The dead code in a set of files, `{ [path]: text }`: paths relative to the app's src (`state/run.ts`);
 * files outside it (`../e2e/x.spec.ts`) only count as users.
 */
export function findDeadCode(files, keep = KEEP) {
  const found = []
  const inSrc = (f) => !f.startsWith('../')
  const names = Object.keys(files)
  const appUsers = (except, name) => names.filter((f) => !except.includes(f) && inSrc(f) && !isTest(f) && count(files[f], name) > 0)
  for (const file of names.filter((f) => inSrc(f) && !isTest(f) && /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))) {
    const text = files[file]
    for (const { name, target, component } of exportsOf(text, file)) {
      if (name === 'default' || keep[`${file} ${name}`]) continue
      // A re-export's own file names it too (its definition): it is not a user.
      const except = [file, target]
      const users = names.filter((f) => !except.includes(f) && count(files[f], name) > 0)
      if (!users.length && count(text, name) <= 1) found.push(`${file}: export ${name} is used nowhere`)
      else if (component && !appUsers(except, name).length) found.push(`${file}: component ${name} is only used by tests`)
    }
    // Its own file names an action twice (the interface and the store); a third is a call.
    if (file.startsWith('state/'))
      for (const action of actionsOf(text))
        if (count(text, action) <= 2 && !appUsers([file], action).length) found.push(`${file}: store action ${action} is never called by the app`)
  }
  return found
}

function read(dir, base, out = {}) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) read(full, base, out)
    else if (/\.(tsx?|mts|mjs)$/.test(entry.name)) out[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8')
  }
  return out
}

function main() {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const src = path.join(web, 'src')
  const files = { ...read(src, src), ...read(path.join(web, 'e2e'), src), ...read(path.join(web, 'scripts'), src) }
  const found = findDeadCode(files)
  for (const f of found) console.log(f)
  console.log(
    found.length
      ? `\n${found.length} dead export(s) in apps/web/src: delete them (or add one to KEEP in scripts/dead-code.mjs, with why).`
      : 'No dead code in apps/web/src.',
  )
  if (found.length) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
