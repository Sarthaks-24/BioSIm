import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { Simulation } from '@biosim/engine'
import FlatBody from '../flat/FlatBody.tsx'
import { hasWebGL } from '../lib/webgl.ts'

const BodyCanvas = lazy(() => import('../three/BodyCanvas.tsx'))

/** 3D when the device can, flat diagram otherwise — and while the 3D code is still loading. */
export default function BodyView({ sim, label }: { sim: Simulation; label: string }) {
  const flat = <FlatBody sim={sim} label={label} />
  if (!hasWebGL()) return flat
  return (
    <WebGLBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <BodyCanvas sim={sim} label={label} />
      </Suspense>
    </WebGLBoundary>
  )
}

/** If WebGL fails at runtime (context lost, driver bug), fall back instead of a blank box. */
class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
