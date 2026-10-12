import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './styles.css'
import './i18n/index.ts'
import Layout from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import { ErrorPage, NotFound } from './pages/Misc.tsx'

const Simulator = lazy(() => import('./pages/Simulator.tsx'))
const Teach = lazy(() => import('./pages/Teach.tsx'))
const Science = lazy(() => import('./pages/Science.tsx'))
const About = lazy(() => import('./pages/About.tsx'))
const Privacy = lazy(() => import('./pages/Privacy.tsx'))
const Stats = lazy(() => import('./pages/Stats.tsx'))

const page = (el: React.ReactNode) => <Suspense fallback={<p className="p-10 text-center text-ink-2">…</p>}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/sim', element: page(<Simulator />) },
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
