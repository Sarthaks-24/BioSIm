import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import './styles.css'
import { addEnglish, i18nReady } from './i18n/index.ts'
import { readPref } from './lib/prefs.ts'
import Layout, { type RouteHandle } from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import { ErrorPage, NotFound } from './pages/Misc.tsx'

// Home's words are a page section (I-1, scripts/i18n-sections.mjs): not in every page's first
// download. Its code stays here (a lazy Home splits the entry's shared code into more files, which
// costs more than it saves). On "/" the words start loading with the app and the first draw waits
// for them, so Home draws at once; opened later, Home waits for them like any lazy page.
let homeWords = false
const loadHomeWords = () =>
  import('virtual:lifepeek-en/home').then((m) => {
    addEnglish(m.default)
    homeWords = true
  })
const homeFirst = location.pathname === '/' ? loadHomeWords() : undefined
const HomeWithWords = lazy(() => loadHomeWords().then(() => ({ default: Home })))
const HomePage = () => (homeWords ? <Home /> : page(<HomeWithWords />))
// The one-screen stage (WP-19 made it /sim; WP-20 deleted v1's page and gave it that file name).
const Simulator = lazy(() => import('./pages/Simulator.tsx'))
const Teach = lazy(() => import('./pages/Teach.tsx'))
const Science = lazy(() => import('./pages/Science.tsx'))
const About = lazy(() => import('./pages/About.tsx'))
const Privacy = lazy(() => import('./pages/Privacy.tsx'))
const Stats = lazy(() => import('./pages/Stats.tsx'))

/** /next was the v2 screen's address while it was built (WP-11…18); its links open /sim, with the same query. */
function ToSim() {
  const { search, hash } = useLocation()
  return <Navigate replace to={{ pathname: '/sim', search, hash }} />
}

const page = (el: React.ReactNode) => <Suspense fallback={<p className="p-10 text-center text-ink-muted">…</p>}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/sim', element: page(<Simulator />), handle: { fit: true } satisfies RouteHandle },
      { path: '/next', element: <ToSim /> },
      { path: '/teach', element: page(<Teach />) },
      { path: '/science', element: page(<Science />) },
      { path: '/about', element: page(<About />) },
      { path: '/privacy', element: page(<Privacy />) },
      { path: '/stats', element: page(<Stats />) },
      { path: '*', element: <NotFound /> },
    ],
  },
])

// After a new version is deployed, an open tab may ask for code files that no longer exist.
// Reload once to pick up the new version instead of failing.
// The flag stops a reload loop; it's cleared once the app has run for a while, so a later update
// in the same tab can reload again.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('lifepeek:reloaded')) return
    sessionStorage.setItem('lifepeek:reloaded', '1')
  } catch {
    return // storage blocked: show the error page instead of risking a loop
  }
  e.preventDefault()
  window.location.reload()
})
setTimeout(() => {
  try {
    sessionStorage.removeItem('lifepeek:reloaded')
  } catch {
    // ignore
  }
}, 10_000)

// The in-app Reduce motion choice reaches CSS before the first draw (Home's reveal must not
// start): html[data-motion], which state/motion.ts keeps up to date once the stage has loaded it.
// Without a choice ('1' or '0'; the store ignores anything else too) the stylesheet follows the
// device. Not the store itself: it is not first paint.
const motionChoice = readPref('reduceMotion')
if (motionChoice === '1' || motionChoice === '0') document.documentElement.dataset.motion = motionChoice === '1' ? 'reduce' : 'full'

// Draw once the first language is ready (Hindi is fetched on demand). If it fails to load, draw
// anyway: every key falls back to English.
const draw = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
void Promise.all([i18nReady, homeFirst]).then(draw, draw)

// The service worker, and the "new version is ready" note (components/UpdateToast.tsx), once the
// page has loaded (a module script always runs before "load"): not part of any page's first
// download (size budget).
// A school browser may block it: the page works the same without (offline use aside).
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  addEventListener('load', () => import('./components/UpdateToast.tsx').then((m) => m.watchForUpdates()).catch(() => undefined), {
    once: true,
  })
