import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * FP-10: one token set. The old colour names (v1 paper/panel/sunk/rule, v2 paper2/shelf/sunk2/rule2,
 * ink-2) were merged into surface-page/raised/sunk, border, grid, ink and ink-muted. Tailwind
 * makes no class for a name @theme no longer defines, so an old class would silently draw nothing:
 * this fails if one comes back, as a utility (`bg-shelf`, `max-sm:border-rule`, `bg-panel/90`) or
 * as a CSS variable (`var(--color-rule)`).
 */
const OLD = ['paper2', 'paper', 'panel', 'shelf', 'sunk2-hover', 'sunk2', 'sunk', 'rule2', 'rule', 'ink-2']
const UTILITY =
  'bg|text|border(?:-[trblxyse])?|divide|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|shadow|caret|accent|placeholder'
const PATTERN = new RegExp(`(?:--color-|(?<![\\w-])(?:${UTILITY})-)(${OLD.join('|')})(?![\\w-])`, 'g')

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const self = fileURLToPath(import.meta.url)

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return d.name.endsWith('-snapshots') ? [] : files(p)
    return /\.(tsx?|css|mjs)$/.test(d.name) && p !== self ? [p] : []
  })
}

/** `file:line name` for every old token name in the text. */
function oldNames(text: string, file = 'text'): string[] {
  return text.split('\n').flatMap((line, i) => [...line.matchAll(PATTERN)].map((m) => `${file}:${i + 1} ${m[0]}`))
}

describe('one colour token set (FP-10)', () => {
  it('finds old names in every form it guards against', () => {
    const found = oldNames(
      `bg-shelf max-sm:border-rule bg-panel/90 hover:bg-sunk2-hover text-ink-2 fill-ink-2 divide-rule var(--color-rule2) --color-paper:`,
    )
    expect(found).toHaveLength(9)
    // The new names, and words that only look alike, pass.
    expect(oldNames('bg-surface-sunk border-border text-ink-muted stroke-grid Lab-paper palette rules-of-thumb')).toEqual([])
  })

  it('no source, style or test file uses an old name', () => {
    const found = [...files(path.join(web, 'src')), ...files(path.join(web, 'e2e')), ...files(path.join(web, 'scripts'))].flatMap((f) =>
      oldNames(readFileSync(f, 'utf8'), path.relative(web, f)),
    )
    expect(found).toEqual([])
  })
})
