// A vh fallback before every dvh, svh and lvh in the built CSS (R87, T11's finding).
//
// A browser without the dynamic viewport units (Chrome before 108, Safari before 15.4, Firefox
// before 101: older school phones) drops a declaration it cannot read, so `min-height: 100dvh`
// alone means no minimum height there. Written by hand, `min-height: 100vh; min-height: 100dvh`
// does not survive the build: Tailwind's optimizer and Vite's CSS minifier (Lightning CSS) remove
// the first as a duplicate, since every browser they target reads dvh. So this Vite plugin adds
// the fallbacks to the finished CSS files, after both: each declaration with a dvh, svh or lvh
// length gets the same one in vh just before it, in the same rule (Tailwind's `*-dvh` classes,
// their arbitrary values, and styles.css). Custom properties are left alone (any value is valid
// there, so a fallback would never be used). e2e/invariants.spec.ts checks the result.
// Build-time only: nothing reaches the app's JavaScript; a few bytes of CSS (size budget).

/** A declaration whose value has a dvh, svh or lvh length: `{` or `;`, the property, `:`, its value. */
const DYNAMIC = /([{;])(-?[a-z][a-z-]*):([^;{}]*\d[dsl]vh\b[^;{}]*)(?=[;}])/g

/** `css` with a vh fallback before each declaration that uses dvh, svh or lvh. */
export function addVhFallbacks(css) {
  return css.replace(DYNAMIC, (_, start, prop, value) => `${start}${prop}:${value.replace(/(\d)[dsl]vh\b/g, '$1vh')};${prop}:${value}`)
}

/** The Vite plugin: rewrites the build's CSS files once they are minified. */
export default function vhFallback() {
  return {
    name: 'lifepeek:vh-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        file.source = addVhFallbacks(typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source))
      }
    },
  }
}
