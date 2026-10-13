import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import './styles.css'
import { i18nReady } from './i18n/index.ts'
import { readPref } from './lib/prefs.ts'
import Layout, { type RouteHandle } from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import { ErrorPage, NotFound } from './pages/Misc.tsx'

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

const page = (el: React.ReactNode) => <Suspense fallback={<p className="p-10 text-center text-ink-2">…</p>}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
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
void i18nReady.then(draw, draw)

// The service worker, and the "new version is ready" note (components/UpdateToast.tsx), once the
// page has loaded (a module script always runs before "load"): not part of any page's first
// download (size budget).
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  addEventListener('load', () => import('./components/UpdateToast.tsx').then((m) => m.watchForUpdates()), { once: true })
