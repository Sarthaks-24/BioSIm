import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { GoldenCall } from '../src/core/coverage.ts'

/**
 * Static scan for golden(…), golden.fails(…) and pinned(…) calls (same technique as the i18n key
 * scan in apps/web/src/i18n/i18n.test.ts). Reads the first arguments as literals:
 *   golden(ids, sources, 'title', fn) · golden.fails(ids, sources, 'title', 'reason', fn) · pinned(ids, 'title', fn)
 * A call it cannot read throws, so a test can never silently drop out of the coverage count.
 */

/** Files that define or test the wrappers rather than use them. */
const SKIP = new Set(['golden.ts', 'golden-scan.ts', 'contract.test.ts'])
const CALL_RE = /(?<![\w.])(golden\.fails|golden|pinned)\(/g

export function scanGoldenCalls(dir: string): GoldenCall[] {
  return testFiles(dir).flatMap((file) => parseGoldenCalls(readFileSync(file, 'utf8'), relative(dir, file).split('\\').join('/')))
}

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : testFiles(join(dir, e.name))
    return e.name.endsWith('.ts') && !SKIP.has(e.name) ? [join(dir, e.name)] : []
  })
}

export function parseGoldenCalls(text: string, file: string): GoldenCall[] {
  const calls: GoldenCall[] = []
  for (const m of text.matchAll(CALL_RE)) {
    const line = text.slice(0, m.index).split('\n').length
    // `function golden(` / `export function pinned(` are definitions, not calls.
    if (/function\s+$/.test(text.slice(Math.max(0, m.index - 20), m.index))) continue
    const kind = m[1] === 'golden.fails' ? 'fails' : m[1] === 'golden' ? 'golden' : 'pinned'
    const r = new Reader(text, m.index + m[0].length, `${file}:${line}`)
    const ids = r.stringOrList()
    r.comma()
    const sources = kind === 'pinned' ? [] : r.list()
    if (kind !== 'pinned') r.comma()
    const title = r.string()
    calls.push({ kind, ids, sources, file, line, title })
  }
  return calls
}

/** A tiny reader for string literals and arrays of string literals. */
class Reader {
  constructor(
    private text: string,
    private pos: number,
    private where: string,
  ) {}

  private skip() {
    while (/\s/.test(this.text[this.pos] ?? '')) this.pos++
  }

  private fail(what: string): never {
    throw new Error(`golden-scan: ${this.where}: expected ${what} near "${this.text.slice(this.pos, this.pos + 30)}"`)
  }

  string(): string {
    this.skip()
    const q = this.text[this.pos]
    if (q !== "'" && q !== '"' && q !== '`') this.fail('a string literal')
    const end = this.text.indexOf(q, this.pos + 1)
    if (end < 0) this.fail('a closing quote')
    const s = this.text.slice(this.pos + 1, end)
    if (q === '`' && s.includes('${')) this.fail('a plain string (no ${…})')
    this.pos = end + 1
    return s
  }

  list(): string[] {
    this.skip()
    if (this.text[this.pos] !== '[') this.fail('[')
    this.pos++
    const out: string[] = []
    for (;;) {
      this.skip()
      if (this.text[this.pos] === ']') break
      out.push(this.string())
      this.skip()
      if (this.text[this.pos] === ',') this.pos++
      else if (this.text[this.pos] !== ']') this.fail(', or ]')
    }
    this.pos++
    return out
  }

  stringOrList(): string[] {
    this.skip()
    return this.text[this.pos] === '[' ? this.list() : [this.string()]
  }

  comma() {
    this.skip()
    if (this.text[this.pos] !== ',') this.fail(',')
    this.pos++
  }
}
