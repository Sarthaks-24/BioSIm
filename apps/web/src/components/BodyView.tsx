import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation } from '@biosim/engine'
import FlatBody from '../flat/FlatBody.tsx'
import { hasWebGL } from '../lib/webgl.ts'

const BodyCanvas = lazy(() => import('../three/BodyCanvas.tsx'))

/**
 * 3D when the device can, the flat diagram otherwise — while the 3D code loads, if WebGL is
 * missing, if it crashes, or if the GPU drops the context. The flat view says why it's showing.
 */
export default function BodyView({ sim, label }: { sim: Simulation; label: string }) {
  const [lost, setLost] = useState(false)
  const flat = <FlatBody sim={sim} label={label} />
  const fallback = (
    <>
      {flat}
      <NoWebglNote />
    </>
  )
  if (!hasWebGL() || lost) return fallback
  return (
    <WebGLBoundary fallback={fallback}>
      <Suspense fallback={flat}>
        <BodyCanvas sim={sim} label={label} onContextLost={() => setLost(true)} />
      </Suspense>
    </WebGLBoundary>
  )
}

function NoWebglNote() {
  const { t } = useTranslation()
  return <p className="absolute right-2 bottom-2 left-2 rounded-md bg-panel/90 px-2 py-1 text-xs text-ink-2">{t('sim.noWebgl')}</p>
}

/** If WebGL fails at runtime (driver bug, shader error), fall back instead of a blank box. */
class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
