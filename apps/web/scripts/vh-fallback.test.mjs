import { describe, expect, it } from 'vitest'
import { addVhFallbacks } from './vh-fallback.mjs'

describe('vh fallbacks in the built CSS (R87)', () => {
  it('puts a vh copy before each declaration with dvh, svh or lvh, in the same rule', () => {
    expect(addVhFallbacks('.min-h-dvh{min-height:100dvh}')).toBe('.min-h-dvh{min-height:100vh;min-height:100dvh}')
    expect(addVhFallbacks('.a{color:red;max-height:min(32rem,100dvh - 2rem)}')).toBe(
      '.a{color:red;max-height:min(32rem,100vh - 2rem);max-height:min(32rem,100dvh - 2rem)}',
    )
    expect(addVhFallbacks('.b{height:50svh;width:1px}')).toBe('.b{height:50vh;height:50svh;width:1px}')
    expect(addVhFallbacks('[data-stage]{grid-template-rows:auto 1fr minmax(9rem,clamp(9rem,46.5dvh - 8rem,15rem)) auto}')).toBe(
      '[data-stage]{grid-template-rows:auto 1fr minmax(9rem,clamp(9rem,46.5vh - 8rem,15rem)) auto;grid-template-rows:auto 1fr minmax(9rem,clamp(9rem,46.5dvh - 8rem,15rem)) auto}',
    )
  })

  it('works inside media queries and leaves selectors, custom properties and plain vh alone', () => {
    const media = '@media (width<64rem){.max-lg\\:max-h-\\[80dvh\\]{max-height:80dvh}}'
    expect(addVhFallbacks(media)).toBe('@media (width<64rem){.max-lg\\:max-h-\\[80dvh\\]{max-height:80vh;max-height:80dvh}}')
    for (const css of ['.c{--h:100dvh}', '.d{height:100vh}', '.e{width:3dvw}']) expect(addVhFallbacks(css)).toBe(css)
  })
})
