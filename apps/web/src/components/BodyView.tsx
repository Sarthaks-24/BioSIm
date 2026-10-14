import { Component, Suspense, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { RunResult } from '@lifepeek/engine'
import type { ActivityBand } from '../anatomy/human/bands.ts'
import FlatBody from '../flat/FlatBody.tsx'
import { useRunStore } from '../state/run.ts'
import { packDrawing } from '../systems/load.ts'
import { systemOf } from '../systems/registry.ts'
import { hasWebGL, sayBody, use3dTries, type BodyNote } from '../lib/webgl.ts'
import { isLoadError, lazyWithRetry } from './LoadBoundary.tsx'
import type BodyCanvasType from '../three/BodyCanvas.tsx'

/** The 3D body loads when the stage first shows it, and is cached then (lp-lazy, T12d): not at install. */
const bodyCanvas = lazyWithRetry<ComponentProps<typeof BodyCanvasType>>(() => import('../three/BodyCanvas.tsx'))

/**
 * 3D when the device can, the flat diagram otherwise — while the 3D code loads, if WebGL is
 * missing, if it crashes, if the GPU drops the context, or if its file doesn't arrive (offline
 * before it was ever loaded: it needs the internet once). The stage's notes say why
 * (stage/Notes.tsx), in a line of their own; a slow or failed load too (R71). On a phone that line
 * lies over the top of the body pane, so a note that comes late moves nothing (R87).
 *
 * `sim` is the stage's current run: its signal table is what the bodies read through `valueAt`.
 * `band`: the activity band at this minute (lib/bouts.ts): the flat body's still pose (A-0).
 * A lit system with no 3D layer (every new system in v3.0, flat first: R43) is drawn flat on every
 * device, with no note: that is its picture, not a stand-in. So is a panels row's plain body
 * (reproduction: nothing on the body, R-1).
 */
export default function BodyView({ sim, label, band }: { sim: RunResult; label: string; band?: ActivityBand }) {
  const [lost, setLost] = useState(false)
  // Try again (or the internet coming back) asks for the 3D file again: a new boundary.
  const tries = use3dTries()
  const system = systemOf(useRunStore((s) => s.layer))
  // Another system's flat drawing: lit only once its pack has loaded (state/run.ts setLayer), so it is here.
  const layer = system && packDrawing(system.id)
  const flat = <FlatBody sim={sim} label={label} band={band} system={system} layer={layer} />
  const fallback = (why: BodyNote) => (
    <>
      <FlatBody sim={sim} label={label} band={band} system={system} layer={layer} final />
      <Say why={why} />
    </>
  )
  const BodyCanvas = bodyCanvas.Component
  const body =
    system && system.draw !== 'body' && !system.layer3d ? (
      <FlatBody sim={sim} label={label} band={band} system={system} layer={layer} final />
    ) : !hasWebGL() || lost ? (
      fallback('webgl')
    ) : (
      <WebGLBoundary key={tries} fallback={fallback} onLoadFail={bodyCanvas.reset}>
        <Suspense
          fallback={
            <>
              {flat}
              <Say why="slow" after={6000} />
            </>
          }
        >
          <BodyCanvas sim={sim} label={label} onContextLost={() => setLost(true)} placeholder={flat} layer3d={system?.layer3d} />
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

/** Tells the stage's notes why the flat body is shown (lib/webgl.ts), `after` ms from now; a slow note goes with it. */
function Say({ why, after = 0 }: { why: BodyNote; after?: number }) {
  useEffect(() => {
    const timer = setTimeout(() => sayBody(why), after)
    return () => {
      clearTimeout(timer)
      sayBody('', 'slow')
    }
  }, [why, after])
  return null
}

/**
 * If WebGL fails at runtime (driver bug, shader error), fall back instead of a blank box. If the 3D
 * file did not arrive, the flat body stays too, and the note says why: offline it needs the
 * internet once; online, Try again (main.tsx has already reloaded once for a stale file).
 */
class WebGLBoundary extends Component<
  { fallback: (why: BodyNote) => ReactNode; onLoadFail: () => void; children: ReactNode },
  { failed: BodyNote }
> {
  state = { failed: '' as BodyNote }
  static getDerivedStateFromError(error: unknown) {
    return { failed: isLoadError(error) ? (navigator.onLine ? 'failed' : 'offline') : 'webgl' }
  }
  componentDidCatch(error: unknown) {
    if (isLoadError(error)) this.props.onLoadFail()
  }
  render() {
    return this.state.failed ? this.props.fallback(this.state.failed) : this.props.children
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
