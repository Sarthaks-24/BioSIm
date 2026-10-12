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
      { path: '*', element: <NotFound /> },
    ],
  },
])

// After a new version is deployed, an open tab may ask for code files that no longer exist.
// Reload once to pick up the new version instead of failing.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('biosim:reloaded')) return
  sessionStorage.setItem('biosim:reloaded', '1')
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
