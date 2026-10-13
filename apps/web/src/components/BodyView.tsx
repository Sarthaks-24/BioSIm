import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Simulation } from '@lifepeek/engine'
import FlatBody from '../flat/FlatBody.tsx'
import { hasWebGL, sayFlat } from '../lib/webgl.ts'

const BodyCanvas = lazy(() => import('../three/BodyCanvas.tsx'))

/**
 * 3D when the device can, the flat diagram otherwise — while the 3D code loads, if WebGL is
 * missing, if it crashes, or if the GPU drops the context. When it stands in for good, the stage's
 * notes say why (stage/Notes.tsx), in a line of their own, not over the body.
 *
 * `sim` is the stage's current run: its signal table is what the bodies read through `valueAt`.
 */
export default function BodyView({ sim, label }: { sim: Simulation; label: string }) {
  const [lost, setLost] = useState(false)
  const flat = <FlatBody sim={sim} label={label} />
  const fallback = (
    <>
      <FlatBody sim={sim} label={label} final />
      <SayFlat />
    </>
  )
  const body =
    !hasWebGL() || lost ? (
      fallback
    ) : (
      <WebGLBoundary fallback={fallback}>
        <Suspense fallback={flat}>
          <BodyCanvas sim={sim} label={label} onContextLost={() => setLost(true)} placeholder={flat} />
        </Suspense>
      </WebGLBoundary>
    )
  return (
    <>
      {body}
      {DEBUG_FPS && <FpsOverlay />}
    </>
  )
}

/** Tells the stage's notes that the flat body stands in for the 3D one (lib/webgl.ts). */
function SayFlat() {
  useEffect(sayFlat, [])
  return null
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

/** `?debug=fps` in the address: the phone check (docs/PHONE-CHECK.md) reads its numbers here. */
const DEBUG_FPS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'fps'

/** What three.js reports about its last frame (WebGLRenderer.info), when the 3D body is on. */
interface GlInfo {
  render: { frame: number; calls: number; triangles: number }
}

/**
 * A small developer readout over the body: browser frames per second (requestAnimationFrame),
 * and with 3D also how many times per second the body was drawn, its draw calls and triangles.
 * Not translated and not in the normal page: it exists only behind ?debug=fps. It asks for a
 * frame every frame, so the page never idles while it is on.
 */
function FpsOverlay() {
  const [text, setText] = useState('…')
  const last = useRef({ t: 0, frames: 0, gl: 0 })
  useEffect(() => {
    let raf = 0
    let frames = 0
    const tick = (now: number) => {
      frames++
      const l = last.current
      if (!l.t) l.t = now
      if (now - l.t >= 1000) {
        const secs = (now - l.t) / 1000
        const info = (window as { __lifepeekGl?: GlInfo }).__lifepeekGl
        const parts = [`${(frames / secs).toFixed(0)} fps`, `dpr ${window.devicePixelRatio}`]
        if (info) {
          parts.push(
            `3D ${((info.render.frame - l.gl) / secs).toFixed(0)} draws/s`,
            `${info.render.calls} calls`,
            `${(info.render.triangles / 1000).toFixed(1)}k tris`,
          )
          l.gl = info.render.frame
        } else parts.push('flat')
        setText(parts.join(' · '))
        l.t = now
        frames = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <output className="absolute top-2 right-2 z-20 rounded bg-ink/85 px-2 py-1 font-mono text-xs text-white" aria-live="off">
      {text}
    </output>
  )
}
