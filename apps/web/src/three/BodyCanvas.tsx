import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  setConsoleFunction,
} from 'three'
import { NUTRIENT_KINDS, activeStage, type NutrientKind, type RunResult, type StageId } from '@lifepeek/engine'
import type { Loader } from '../registry/types.ts'
import { useBodyClock, type BodyClock } from '../hooks/useBodyClock.ts'
import { particlePosition, tumble } from '../anatomy/human/digestion.ts'
import { useCalloutSpecs, useCallouts, type CalloutSpec, type Callouts, type Project } from '../anatomy/CalloutOverlay.tsx'
import type { Callout } from '../anatomy/callouts.ts'
import type { Framing } from '../anatomy/human/base.ts'
import { useMotion } from '../state/motion.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { NUTRIENT_COLOR } from '../lib/colors.ts'
import { particleMaterial, setLook } from './materials.ts'
import { geometryTier, quality } from './quality.ts'
import type { Layer3d, OverlayProps, Tier } from './layer.ts'
import { mountBase, mountLayer, mountStats, pinBase, pinLayer, releaseBase, releaseLayer, type MountedBase } from './mount.ts'
import { DIGESTION_3D } from './layers/digestion.ts'

// three.js r183 deprecated THREE.Clock, which fiber still makes for every canvas: a console warning
// on every load (B19) that is not ours to fix. Only that line is dropped; the rest goes on as before.
setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...params: unknown[]) => {
  if (type === 'warn' && message.startsWith('THREE.Clock:')) return
  console[type](message, ...params)
})

interface Props {
  sim: RunResult
  /** Accessible description of what the picture shows. */
  label: string
  /** Called if the GPU drops the WebGL context (common on cheap phones); the parent shows the flat view instead. */
  onContextLost?: () => void
  /** Shown in the body's place until the 3D body has drawn its first frame (the flat body). */
  placeholder?: ReactNode
  /** The lit system's 3D layer (SystemDef.layer3d), loaded on first use; none = digestion's, in this chunk. */
  layer3d?: Loader<Layer3d>
}

/**
 * One stylized body for one meal. Renders only when something changes (frameloop "demand"): the
 * clock moving (playing or scrubbing), the meal, the motion setting, a drag. A paused page draws
 * nothing, which saves a school laptop's battery and a cheap phone's heat.
 *
 * The canvas is made only once its box has a stable, non-zero size and the fonts are in (B17: on a
 * busy WebKit the stage was still settling, and the first frames and labels were drawn for a box
 * that then changed). Until it has drawn, the placeholder (the flat body) stays, so the body is
 * never blank. `data-ready` on the box says the 3D body is drawn (the e2e tests wait for it).
 */
export default function BodyCanvas({ sim, label, onContextLost, placeholder, layer3d }: Props) {
  // Read outside <Canvas> and passed down, so the scene does not depend on context bridging.
  const clock = useBodyClock()
  const stage = useStage(sim, clock)
  const reduced = useMotion((s) => s.reduced)
  const q = useMemo(() => quality(), [])
  const tier = useMemo(() => geometryTier(), [])
  const layer = useLayer3d(layer3d)
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })
  const invalidate = useRef<() => void>(() => {})
  // The lit layer's own labels (breathing's), else Digestion's.
  const { t } = useTranslation()
  const digestionSpecs = useCalloutSpecs(stage, width)
  const labels = layer?.labels
  const specs = (labels ? labels.specs(t, width, height) : digestionSpecs) as CalloutSpec<string>[]
  const { overlay, place } = useCallouts(specs, () => invalidate.current(), labels?.table as Record<string, Callout> | undefined)
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // A rhythm's phase and rate now (LitLayer moves them on the real clock; the layer's overlay reads them).
  const rhythm = useRef({ phase: 0, hz: 0 }).current
  // What the layer's overlay places each frame the scene draws (LabelProjector calls them).
  const overlays = useRef(new Set<Place>()).current
  const register = useCallback(
    (fn: Place) => {
      overlays.add(fn)
      invalidate.current()
      return () => void overlays.delete(fn)
    },
    [overlays],
  )
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const settled = useSettled(wrapper)
  const [drawn, setDrawn] = useState(false)
  // The canvas's `webglcontextlost` listener, removed when this body goes. Fiber 9 calls
  // forceContextLoss() on the canvas when it unmounts (a system with no 3D layer was lit): that
  // loss is ours, not the GPU's, and must not turn 3D off for the rest of the visit.
  const lostListener = useRef<{ canvas: HTMLCanvasElement; listener: (e: Event) => void } | null>(null)
  const lost = useRef(onContextLost)
  lost.current = onContextLost
  useEffect(
    () => () => {
      const l = lostListener.current
      l?.canvas.removeEventListener('webglcontextlost', l.listener)
      lostListener.current = null
      lost.current = undefined
    },
    [],
  )

  return (
    // data-particles says whether the food tumbles (reduced motion: "still"); the reduced-motion test reads it.
    <div
      className="relative h-full w-full"
      ref={wrapper}
      data-body="3d"
      data-ready={drawn ? '' : undefined}
      data-particles={reduced ? 'still' : 'tumbling'}
      data-layer={layer?.id}
      data-framing={layer?.framing ?? 'torso'}
    >
      {settled && (
        <Canvas
          style={drawn ? undefined : { visibility: 'hidden' }}
          frameloop="demand"
          dpr={[1, q.dpr]}
          // The `torso` framing (scene y −1.9 … 3.45, as the flat body's VIEW), with room over the
          // head so it never touches the meal bar (FP-2).
          camera={{ position: [0, 0.8, 9.4], fov: 32 }}
          gl={{ antialias: q.antialias, alpha: true, powerPreference: 'low-power' }}
          aria-label={label}
          role="img"
          onCreated={({ gl, camera, invalidate: redraw }) => {
            invalidate.current = () => redraw()
            const listener = (e: Event) => {
              e.preventDefault()
              lost.current?.()
            }
            gl.domElement.addEventListener('webglcontextlost', listener)
            lostListener.current = { canvas: gl.domElement, listener }
            // The ?debug=fps overlay (BodyView) reads draw calls and triangles from here; the e2e
            // label check projects the organs itself, with the camera.
            // __lifepeek3d: what three/mount.ts holds (the e2e leak check after switching systems).
            Object.assign(window, { __lifepeekGl: gl.info, __lifepeekCamera: camera, __lifepeek3d: mountStats })
          }}
        >
          <Lighting />
          {/* One lit layer at a time (anatomy plan D5); a new system's layer replaces it once it has loaded. */}
          {layer && (
            <LitLayer key={layer.id} layer={layer} tier={tier} sim={sim} clock={clock} reduced={reduced} rhythm={rhythm} body={wrapper} />
          )}
          <Base tier={tier} sim={sim} clock={clock} reduced={reduced} food={layer?.food !== false} />
          <OrbitControls
            ref={controls}
            makeDefault
            enablePan={false}
            minDistance={3.5}
            maxDistance={11}
            target={[0, 0.8, 0]}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
          />
          <CameraRig framing={layer?.framing ?? 'torso'} reduced={reduced} controls={controls} />
          <LabelProjector place={place} overlays={overlays} />
          <Invalidator sim={sim} clock={clock} reduced={reduced} />
          {layer && <FirstFrame onDrawn={() => setDrawn(true)} />}
        </Canvas>
      )}
      {/* Measured from the start (hidden, not removed), placed by the 3D body's frames. */}
      <div style={drawn ? undefined : { opacity: 0 }}>
        {layer?.overlay && <LayerOverlay key={layer.id} layer={layer} reduced={reduced} t={t} rhythm={rhythm} register={register} />}
        {overlay}
      </div>
      {!drawn && placeholder && <div className="absolute inset-0">{placeholder}</div>}
    </div>
  )
}

/** Frames the box's size must stay the same for before the canvas is made. */
const STABLE_FRAMES = 2
/** Fonts that never finish loading (a blocked font server) are waited for no longer than this. */
const FONTS_WAIT_MS = 3000

/**
 * True once the element has a non-zero size that stayed the same for STABLE_FRAMES frames, after the
 * fonts are ready (they change the stage's text, and so the box). It checks only while it waits: a
 * box of size 0 (a hidden pane) asks for no frames until its ResizeObserver says it changed.
 */
function useSettled(ref: RefObject<HTMLElement | null>): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || settled) return
    let raf = 0
    let same = 0
    let w = -1
    let h = -1
    let fonts = false
    let stopped = false
    const check = () => {
      raf = 0
      const nw = el.clientWidth
      const nh = el.clientHeight
      if (nw === w && nh === h) same++
      else [w, h, same] = [nw, nh, 0]
      if (!nw || !nh) return
      if (fonts && same >= STABLE_FRAMES) setSettled(true)
      else raf = requestAnimationFrame(check)
    }
    const wake = () => {
      if (!raf && !stopped) raf = requestAnimationFrame(check)
    }
    const ro = new ResizeObserver(wake)
    ro.observe(el)
    let timer = 0
    void Promise.race([document.fonts?.ready, new Promise((done) => (timer = window.setTimeout(done, FONTS_WAIT_MS)))]).then(() => {
      fonts = true
      wake()
    })
    return () => {
      stopped = true
      ro.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [ref, settled])
  return settled
}

/** Calls `onDrawn` once, after the scene's first frame is on screen. */
function FirstFrame({ onDrawn }: { onDrawn: () => void }) {
  const done = useRef(false)
  const drawn = useRef(onDrawn)
  drawn.current = onDrawn
  useFrame(() => {
    if (done.current) return
    done.current = true
    requestAnimationFrame(() => drawn.current())
  })
  return null
}

/**
 * The layer to draw: digestion's at once (it is in this chunk); another system's once its chunk has
 * loaded, and until then the one before stays (null on a first mount: the placeholder stays). A
 * chunk that does not arrive is thrown to BodyView's boundary, which shows the flat body and why.
 */
function useLayer3d(load: Loader<Layer3d> | undefined): Layer3d | null {
  const [layer, setLayer] = useState<Layer3d | null>(load ? null : DIGESTION_3D)
  const [, fail] = useState(0)
  useEffect(() => {
    if (!load) {
      setLayer(DIGESTION_3D)
      return
    }
    let live = true
    load().then(
      (m) => live && setLayer(m.default),
      (error: unknown) =>
        live &&
        fail(() => {
          throw error
        }),
    )
    return () => {
      live = false
    }
  }, [load])
  return layer
}

/**
 * Where most of the meal is now. Re-renders only when that changes (a few times per meal), not
 * every sim minute while playing.
 */
function useStage(sim: RunResult, clock: BodyClock): StageId {
  const [stage, setStage] = useState(() => activeStage(sim, clock.now()))
  const shown = useRef(stage)
  useEffect(() => {
    const update = () => {
      const next = activeStage(sim, clock.now())
      if (next !== shown.current) setStage((shown.current = next))
    }
    update()
    return clock.subscribe(update)
  }, [sim, clock])
  return stage
}

/**
 * Studio light without an environment map (no PMREM pass, nothing to download): a cool sky /
 * warm ground hemisphere for the base, a key light from the upper right, a soft blue fill.
 */
function Lighting() {
  return (
    <>
      <hemisphereLight args={['#f4f7ff', '#8a6a62', 2.4]} />
      <directionalLight position={[2.5, 4, 6]} intensity={3.4} />
      <directionalLight position={[-4, -1, 2]} intensity={1.1} color="#d6e6ff" />
    </>
  )
}

/** Re-render the canvas whenever simulated time, the meal or the motion setting changes. */
function Invalidator({ sim, clock, reduced }: { sim: RunResult; clock: BodyClock; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate])
  useEffect(() => invalidate(), [sim, reduced, invalidate])
  return null
}

/**
 * The lit layer: one merged mesh, drawn as tissue and as its ink outline. three/mount.ts owns its
 * mesh and materials (`dispose={null}`: fiber's teardown leaves them to it), and frees their GPU
 * side when the layer goes; the mesh's arrays stay cached for the next mount.
 */
function LitLayer({
  layer,
  tier,
  sim,
  clock,
  reduced,
  rhythm,
  body,
}: {
  layer: Layer3d
  tier: Tier
  sim: RunResult
  clock: BodyClock
  reduced: boolean
  rhythm: OverlayProps['rhythm']
  body: RefObject<HTMLDivElement | null>
}) {
  const m = useMemo(() => mountLayer(layer, tier), [layer, tier])
  useEffect(() => {
    pinLayer(m)
    return () => releaseLayer(m)
  }, [m])
  const redraw = useThree((s) => s.invalidate)
  // A rhythm (a breath): its phase moves on the real clock at the run's rate at the meal-clock minute
  // on screen (the layer's ticker: <= 30 fps, tab visible), and each tick redraws. Motion reduced:
  // the still phase, no ticker.
  useEffect(() => {
    const r = layer.rhythm
    rhythm.phase = r?.still ?? 0
    rhythm.hz = 0
    redraw()
    if (!r || reduced) return
    return r.onTick((dt) => {
      rhythm.hz = r.hz(sim, clock.now())
      rhythm.phase = (rhythm.phase + rhythm.hz * dt) % 1
      redraw()
    })
  }, [layer, reduced, sim, clock, rhythm, redraw])
  // The rhythm's `data-*` on the body, as the flat layer has them; taken off when this layer goes.
  const probed = useRef<Record<string, string>>({})
  const probedAt = useRef(-Infinity)
  useEffect(
    () => () => {
      const el = body.current
      if (el) for (const k of Object.keys(probed.current)) delete el.dataset[k]
    },
    [body],
  )
  // Runs before the scene is drawn (priority -1), so the uniforms belong to this frame's time.
  useFrame(() => {
    const t = clock.now()
    const r = layer.rhythm
    if (r) rhythm.hz = reduced ? 0 : r.hz(sim, t)
    layer.write(m.state, sim, t, r ? rhythm.phase : 0)
    // The `data-*` read-out at most PROBE_HZ times a second: a DOM write per frame on the body's box
    // costs the main thread more than the whole layer's maths (measured, A-3).
    const now = performance.now()
    const el = body.current
    if (!r?.probe || !el || now - probedAt.current < 1000 / PROBE_HZ) return
    probedAt.current = now
    for (const [k, v] of Object.entries(r.probe(sim, t, rhythm.phase, reduced)))
      if (probed.current[k] !== v) el.dataset[k] = probed.current[k] = v
  }, -1)
  // The projector look (3D-5): wider, near-black outlines, less fade. Same shaders, new uniforms.
  const projector = useProjector()
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    setLook(m.uniforms, projector ? 'projector' : 'normal')
    invalidate()
  }, [m, projector, invalidate])

  return (
    <>
      <mesh geometry={m.geometry} material={m.tissue} dispose={null} />
      <mesh geometry={m.geometry} material={m.outline} dispose={null} />
    </>
  )
}

/** The base every layer shares: the skin shell and the food particles. */
function Base({ tier, sim, clock, reduced, food }: { tier: Tier; sim: RunResult; clock: BodyClock; reduced: boolean; food: boolean }) {
  const b = useMemo(() => mountBase(tier), [tier])
  useEffect(() => {
    pinBase(b)
    return () => releaseBase(b)
  }, [b])
  return (
    <>
      <mesh geometry={b.shell} material={b.shellMaterial} renderOrder={20} dispose={null} />
      {/* Kept mounted (no shader is rebuilt on a switch back), hidden when the lit layer draws no food. */}
      <group visible={food}>
        <Swarm particles={b.particles} sim={sim} clock={clock} reduced={reduced} hidden={!food} />
      </group>
    </>
  )
}

const tmpPos = new Vector3()
const tmpScale = new Vector3()
const tmpQuat = new Quaternion()
const tmpEuler = new Euler()
const tmpMatrix = new Matrix4()

/** Particles are drawn ~1.8× their modelled size so they read on a projector. */
const PARTICLE_SCALE = 1.8

/** One invisible draw that clears the depth buffer, so the food draws over the organs it is inside. */
function DepthClear() {
  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3))
    return { geometry: g, material: new MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }) }
  }, [])
  return <mesh geometry={geometry} material={material} renderOrder={5} frustumCulled={false} onBeforeRender={(gl) => gl.clearDepth()} />
}

function Swarm({
  particles,
  sim,
  clock,
  reduced,
  hidden,
}: {
  particles: MountedBase['particles']
  sim: RunResult
  clock: BodyClock
  reduced: boolean
  hidden: boolean
}) {
  const meshes = useRef<Partial<Record<NutrientKind, InstancedMesh>>>({})
  const materials = useMemo(() => Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, particleMaterial(NUTRIENT_COLOR[k])])), []) as Record<
    NutrientKind,
    ReturnType<typeof particleMaterial>
  >
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  const byKind = useMemo(() => {
    const groups = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, [] as RunResult['particles']])) as Record<
      NutrientKind,
      RunResult['particles']
    >
    for (const p of sim.particles) groups[p.kind].push(p)
    return groups
  }, [sim])

  useFrame(() => {
    if (hidden) return
    const t = clock.now()
    for (const kind of NUTRIENT_KINDS) {
      const mesh = meshes.current[kind]
      if (!mesh) continue
      const list = byKind[kind]
      for (let i = 0; i < list.length; i++) {
        const p = list[i]!
        const s = particlePosition(p, t, tmpPos) * PARTICLE_SCALE
        // A slow tumble for life, following the meal clock; none when motion is reduced (UI-7).
        tmpEuler.set(p.seed[0] * 6.28, tumble(p.seed[1], t, reduced), p.seed[2] * 6.28)
        tmpQuat.setFromEuler(tmpEuler)
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale.setScalar(s))
        mesh.setMatrixAt(i, tmpMatrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <DepthClear />
      {NUTRIENT_KINDS.map((kind) =>
        byKind[kind].length === 0 ? null : (
          <instancedMesh
            key={`${kind}-${byKind[kind].length}`}
            ref={(m) => {
              meshes.current[kind] = m ?? undefined
            }}
            args={[particles[kind], materials[kind], byKind[kind].length]}
            renderOrder={10}
            frustumCulled={false}
          />
        ),
      )}
    </>
  )
}

/**
 * Moves the organ labels to where their organs are on screen, every frame the scene draws. The
 * camera and size are this frame's (the frame's state), not those of the last React render: when
 * the box changes, the frame that draws the new size places the labels for it too (B17).
 */
function LabelProjector({ place, overlays }: { place: Callouts['place']; overlays: ReadonlySet<Place> }) {
  const p = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const project: Project = (v) => {
      p.copy(v).project(camera)
      return p.z > 1 ? null : [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
    }
    place(project, size.width, size.height)
    for (const fn of overlays) fn(project, size.width, size.height)
  })
  return null
}

/** How often a rhythm's read-out (Rhythm3d.probe) is written to the body's `data-*`, at most. */
const PROBE_HZ = 8

/** An overlay's per-frame placement (Layer3d.overlay). */
type Place = Parameters<OverlayProps['register']>[0]

/** The lit layer's own drawing over the canvas (Layer3d.overlay: plain DOM, made and cleaned up here). */
function LayerOverlay({ layer, ...props }: OverlayProps & { layer: Layer3d }) {
  const host = useRef<HTMLDivElement>(null)
  const { reduced, t, rhythm, register } = props
  useEffect(
    () => (host.current ? layer.overlay?.(host.current, { reduced, t, rhythm, register }) : undefined),
    [layer, reduced, t, rhythm, register],
  )
  // Not hidden from screen readers: a layer's words (the heart's colour key) are read as the flat
  // drawing's; its pictures (the air dashes, the still arrows) hide themselves.
  return <div ref={host} className="pointer-events-none absolute inset-0" />
}

/**
 * Where the camera looks for each framing (anatomy plan §1): torso is Digestion's view (scene y -1.9 to
 * 3.45, with room over the head); chest (-0.6 to 3.5) is the same fit, closer. A framing with no 3D
 * preset yet is framed as torso.
 */
const CAMERA: Partial<Record<Framing, { y: number; distance: number }>> = {
  torso: { y: 0.8, distance: 9.4 },
  chest: { y: 1.45, distance: 7.3 },
}
/** How long the camera takes to a new framing (anatomy plan §1; a cut with motion reduced). */
const EASE_MS = 600

/**
 * Moves the camera to the lit layer's framing: at once for the first layer (and with motion
 * reduced), else eased over EASE_MS. The way the camera faces (a drag's orbit) is kept; only where it
 * looks and how far away it is change. Runs before the controls' own update (priority -2).
 */
function CameraRig({
  framing,
  reduced,
  controls,
}: {
  framing: Framing
  reduced: boolean
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>
}) {
  const shown = useRef<Framing | null>(null)
  const ease = useRef<{ y: number; distance: number; start: number } | null>(null)
  const dir = useMemo(() => new Vector3(), [])
  useFrame(({ camera, invalidate }) => {
    const c = controls.current
    if (!c) return
    const goal = CAMERA[framing] ?? CAMERA.torso!
    const put = (y: number, distance: number) => {
      dir.subVectors(camera.position, c.target).normalize()
      c.target.set(0, y, 0)
      camera.position.copy(c.target).addScaledVector(dir, distance)
    }
    if (shown.current !== framing) {
      const first = shown.current === null
      shown.current = framing
      ease.current = null
      if (first || reduced) {
        put(goal.y, goal.distance)
        return
      }
      ease.current = { y: c.target.y, distance: camera.position.distanceTo(c.target), start: performance.now() }
    }
    const e = ease.current
    if (!e) return
    const k = Math.min(1, (performance.now() - e.start) / EASE_MS)
    const s = k * k * (3 - 2 * k)
    put(e.y + (goal.y - e.y) * s, e.distance + (goal.distance - e.distance) * s)
    if (k < 1) invalidate()
    else ease.current = null
  }, -2)
  return null
}
