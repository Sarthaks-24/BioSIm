/**
 * The site's pages (T12a, R72): one table for each page's title and its description.
 *
 * Titles are i18n keys the app already has (the nav and footer names), so a title costs the first
 * download only this table; the app sets `document.title` from it on every page change
 * (hooks/useCanonical.ts). Descriptions live only in the built HTML: scripts/prerender-head.mjs
 * writes `dist/<page>/index.html` with the title, description, canonical and og/twitter tags, so
 * link previews and search engines that run no JavaScript see the right page. The app never
 * imports ROUTE_DESCRIPTIONS (size budget: /sim's first download carries no description).
 *
 * vercel.json serves these paths (its test checks the list) and every other path gets a real 404.
 */
export const ROUTE_TITLES = {
  '/': '',
  '/sim': 'nav.simulator',
  '/teach': 'nav.teach',
  '/science': 'nav.science',
  '/about': 'footer.about',
  '/privacy': 'footer.privacy',
  '/stats': 'stats.footer',
} as const

export type RoutePath = keyof typeof ROUTE_TITLES

/** Home's title, and the end of every other page's ("For teachers — LifePeek"). */
export const HOME_TITLE = 'LifePeek — Digestion Simulator'
export const pageTitle = (name: string) => (name ? `${name} — LifePeek` : HOME_TITLE)

/** Each page's meta description and og:description (built HTML only, never in the app's code). */
export const ROUTE_DESCRIPTIONS: Record<RoutePath, string> = {
  '/': 'What happens to food inside a typical healthy body (a model, not yours): watch a meal travel through it, compare it with another, and see where nutrients go and how blood sugar responds.',
  '/sim':
    'Pick a meal and press Play: see how fast it leaves the stomach, where its sugar, protein, fat and fibre go, and how blood sugar and energy respond. Keep one meal to compare it with the next.',
  '/teach':
    'Ready-made LifePeek lessons for a projector and a 40-minute class on nutrition and digestion: comparisons to open, questions with answers, and a QR code for students. Free, no sign-up.',
  '/science':
    'What the LifePeek digestion model computes, what it assumes and leaves out, and the published source behind every food and number it uses.',
  '/about':
    'Who makes LifePeek, how its code, content and food data are licensed, and how to report a mistake. A free, open-source digestion simulator for school students.',
  '/privacy':
    'LifePeek collects no personal data: no accounts, no tracking, no ads. What stays on your device, how reports work, and who to contact about privacy.',
  '/stats':
    'LifePeek in numbers, from public sources only: mistakes reported and fixed each week, the model version and the foods. No visitor counts, no analytics.',
}
