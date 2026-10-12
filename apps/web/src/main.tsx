import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './styles.css'
import './i18n/index.ts'
import Layout from './components/Layout.tsx'
import Home from './pages/Home.tsx'
import { NotFound, ShortLink } from './pages/Misc.tsx'

const Simulator = lazy(() => import('./pages/Simulator.tsx'))
const Teach = lazy(() => import('./pages/Teach.tsx'))
const Science = lazy(() => import('./pages/Science.tsx'))

const page = (el: React.ReactNode) => <Suspense fallback={<p className="p-10 text-center text-ink-2">…</p>}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/sim', element: page(<Simulator />) },
      { path: '/teach', element: page(<Teach />) },
      { path: '/science', element: page(<Science />) },
      { path: '/s/:code', element: <ShortLink /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
