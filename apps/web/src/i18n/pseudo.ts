/**
 * The +40 % pseudo-locale (03 WP-18, gate "Hindi parity"): every English string with accents on
 * its letters, 40 % longer, and in brackets, so a layout that only works for English shows up in
 * the e2e run (hindi.spec.ts) the way a long Hindi string would, and a cut-off end loses its "⟧".
 *
 * Only a build with `VITE_PSEUDO=1` has it (Playwright's web server sets it; Vercel never does):
 * i18n/index.ts uses it behind that flag, so a normal build leaves this file out.
 * Open it with `?lang=pseudo` (or the saved language `en-XA`, the usual pseudo-locale code).
 */
export const PSEUDO_LANG = 'en-XA'

// One row per case, as an alphabet reads.
// prettier-ignore
const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'đ', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ɱ',
  n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Đ', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ṁ',
  N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
}

/** Parts the app reads or fills in, left exactly as they are: {{placeholders}}, **bold** marks, web addresses, <placeholders>. */
const KEEP = /(\{\{\w+\}\}|\*\*|https?:\/\/\S+|<[^>]+>)/

/** One string, 40 % longer: vowels doubled from the start of each word until the extra length is reached. */
export function pseudoText(text: string): string {
  if (!text.trim()) return text
  const parts = text.split(KEEP)
  const visible = parts.reduce((n, p, i) => n + (i % 2 ? 0 : p.length), 0)
  // The two brackets count towards the 40 %.
  let extra = Math.max(0, Math.round(visible * 0.4) - 2)
  // Lengthen the words round-robin: one more letter per word per round, so every word grows a little.
  const words = parts.map((p, i) => (i % 2 ? [p] : p.split(/(\s+)/)))
  // Where each word's next doubled letter goes (it moves on, so "stomach" becomes "stoomaach").
  const from = new Map<string, number>()
  for (let round = 0; extra > 0 && round < 8; round++) {
    let grew = false
    for (const [i, list] of words.entries()) {
      if (i % 2) continue
      for (const [j, word] of list.entries()) {
        if (extra === 0) break
        const start = from.get(`${i}.${j}`) ?? 0
        const rest = word.slice(start)
        const at = rest.search(/[aeiouyAEIOUY]/)
        const k = start + (at < 0 ? rest.search(/[A-Za-z]/) : at)
        if (k < start) continue
        list[j] = word.slice(0, k + 1) + word[k]!.toLowerCase() + word.slice(k + 1)
        from.set(`${i}.${j}`, k + 2)
        extra--
        grew = true
      }
    }
    if (!grew) break
  }
  const body = words.map((list, i) => (i % 2 ? list[0] : list.join('').replace(/[A-Za-z]/g, (c) => ACCENTS[c] ?? c))).join('')
  return `⟦${body}${'~'.repeat(extra)}⟧`
}

/** A whole translation file (or one page's section of it) in the pseudo-locale. */
export function pseudoBundle<T>(value: T): T {
  if (typeof value === 'string') return pseudoText(value) as T
  if (Array.isArray(value)) return value.map(pseudoBundle) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pseudoBundle(v)])) as T
  return value
}
