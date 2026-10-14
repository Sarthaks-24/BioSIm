import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react'
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
import type { Callout, LabelBox } from '../anatomy/callouts.ts'
import type { ActivityBand } from '../anatomy/human/bands.ts'
import { useMotion } from '../state/motion.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { NUTRIENT_COLOR } from '../lib/colors.ts'
import { GHOST, particleMaterial, setLook } from './materials.ts'
import { bodyView, type CameraGoal } from './framing.ts'
import { geometryTier, quality } from './quality.ts'
import type { Layer3d, Limbs3d, OverlayProps, Tier } from './layer.ts'
import {
  loadLimbs,
  mountBase,
  mountGhost,
  mountLayer,
  mountPosed,
  mountStats,
  pinBase,
  pinGhost,
  pinLayer,
  pinPosed,
  releaseBase,
  releaseGhost,
  releaseLayer,
  releasePosed,
  type MountedBase,
} from './mount.ts'
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
  /** The activity band at the clock's minute (lib/bouts.ts): the body's still pose, as the flat body's (R4, R32). */
  band?: ActivityBand
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
export default function BodyCanvas({ sim, label, onContextLost, placeholder, layer3d, band = 'rest' }: Props) {
  // Read outside <Canvas> and passed down, so the scene does not depend on context bridging.
  const clock = useBodyClock()
  const stage = useStage(sim, clock)
  const reduced = useMotion((s) => s.reduced)
  const q = useMemo(() => quality(), [])
  const tier = useMemo(() => geometryTier(), [])
  const layer = useLayer3d(layer3d)
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })
  // The whole standing body, asked for with the switch over the body (A-1a); each system opens at its own framing.
  const [whole, setWhole] = useState<string | null>(null)
  // The view (three/framing.ts): the framing drawn and the camera's goal. The legs (A-1a) show as the
  // flat body's do (flat/registry.ts limbsFor): in the `full` framing, and posed in a bout in any
  // framing. Digestion at rest keeps today's shell and loads none of it.
  const view = bodyView(layer?.framing ?? 'torso', band, !!layer && whole === layer.id, width)
  const { framing, legs } = view
  // The skeleton ghost: with a layer whose flat drawing has the ribs, and in the `full` framing; never on a 2 GB phone (plan §9).
  const ghost = tier === 'high' && !!layer && (!!layer.landmarks || framing === 'full')
  const limbs = useLimbs(legs || ghost)
  // A pane too narrow for the switch's words beside the system's title (a small phone).
  const narrow = width > 0 && width < NARROW_PX
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
  // Boxes no label may take: the lit layer's overlay's (OverlayProps.keepOut), then the whole-body switch's; null: none.
  const keptOut = useRef<[LabelBox | null, LabelBox | null]>([null, null])
  const keepOut = useCallback((box: LabelBox | null) => {
    keptOut.current[0] = box
    invalidate.current()
  }, [])
  const wholeButton = useRef<HTMLButtonElement>(null)
  // The switch's box, measured after each render (its words and the pane's size move it): the labels keep off it.
  useLayoutEffect(() => {
    const b = wholeButton.current
    const box = b ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null
    const was = keptOut.current[1]
    if (box?.x === was?.x && box?.y === was?.y && box?.w === was?.w && box?.h === was?.h) return
    keptOut.current[1] = box
    invalidate.current()
  })
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const settled = useSettled(wrapper)
  const [drawn, setDrawn] = useState(false)
  // The canvas's `webglcontextlost` listener, removed when this body goes. Fiber 9 calls
  // forceContextLoss() on the canvas when it unmounts (a system with no 3D layer was lit): that
  // loss is ours, not the GPU's, and must not turn 3D off for the rest of the visit.
  const lostListener = useRef<{ canvas: HTMLCanvasElement; listener: (e: Event) => void } | null>(null)
  const lost = useRef(onContextLost)
  lost.current = onContextLost
  // This body's renderer info, when its test handles are on window (TEST_HANDLES).
  const handles = useRef<object | null>(null)
  useEffect(
    () => () => {
      const l = lostListener.current
      l?.canvas.removeEventListener('webglcontextlost', l.listener)
      lostListener.current = null
      lost.current = undefined
      // Its renderer's test handles go with it, unless a newer body has put its own there
      // (__lifepeek3d, three/mount.ts's cache, holds no renderer: it stays).
      const w = window as unknown as Record<string, unknown>
      if (handles.current && w.__lifepeekGl === handles.current)
        for (const k of ['__lifepeekGl', '__lifepeekCamera', '__lifepeekScene', '__lifepeekSnap']) delete w[k]
      handles.current = null
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
      data-framing={framing}
      data-pose={legs && limbs ? band : undefined}
      data-ghost={ghost && limbs ? '' : undefined}
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
          onCreated={({ gl, camera, scene, invalidate: redraw }) => {
            invalidate.current = () => redraw()
            const listener = (e: Event) => {
              e.preventDefault()
              lost.current?.()
            }
            gl.domElement.addEventListener('webglcontextlost', listener)
            lostListener.current = { canvas: gl.domElement, listener }
            // Test handles, only with ?debug=fps or in the e2e build (R120 #15: in production they
            // kept the last renderer and its scene alive after the 3D body went), and taken off
            // when this body goes. The ?debug=fps overlay (BodyView) reads draw calls and triangles
            // from here; the e2e label check projects the organs itself, with the camera.
            // __lifepeek3d: what three/mount.ts holds (the e2e leak check after switching systems).
            // __lifepeekScene and __lifepeekSnap (draw now, as a PNG): the e2e double-rim check draws the skin alone (A-1a).
            if (!TEST_HANDLES) return
            Object.assign(window, {
              __lifepeekGl: gl.info,
              __lifepeekCamera: camera,
              __lifepeek3d: mountStats,
              __lifepeekScene: scene,
              __lifepeekSnap: () => (gl.render(scene, camera), gl.domElement.toDataURL()),
            })
            handles.current = gl.info
          }}
        >
          <Lighting />
          {/* One lit layer at a time (anatomy plan D5); a new system's layer replaces it once it has loaded. */}
          {layer && (
            <LitLayer key={layer.id} layer={layer} tier={tier} sim={sim} clock={clock} reduced={reduced} rhythm={rhythm} body={wrapper} />
          )}
          <Base tier={tier} sim={sim} clock={clock} reduced={reduced} food={layer?.food !== false} />
          {legs && limbs ? <PosedShell key={`shell:${band}`} limbs={limbs} tier={tier} band={band} /> : <RestShell tier={tier} />}
          {ghost && limbs && <Ghost key={`ghost:${band}`} limbs={limbs} band={band} />}
          <OrbitControls
            ref={controls}
            makeDefault
            enablePan={false}
            minDistance={3.5}
            maxDistance={view.maxDistance}
            target={[0, 0.8, 0]}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
          />
          <CameraRig goal={view.goal} reduced={reduced} controls={controls} />
          <LabelProjector place={place} overlays={overlays} keptOut={keptOut} />
          <Invalidator sim={sim} clock={clock} reduced={reduced} />
          {layer && <FirstFrame onDrawn={() => setDrawn(true)} />}
        </Canvas>
      )}
      {/* Measured from the start (hidden, not removed), placed by the 3D body's frames. */}
      <div style={drawn ? undefined : { opacity: 0 }}>
        {layer?.overlay && (
          <LayerOverlay key={layer.id} layer={layer} reduced={reduced} t={t} rhythm={rhythm} register={register} keepOut={keepOut} />
        )}
        {overlay}
      </div>
      {/*
       * The whole-body switch (A-1a; anatomy plan §1): the camera eases out to the whole standing body,
       * its legs in the band's pose; pressed again, back to the system's own framing. In the `full`
       * framing on a phone the picture starts close up on the working region, and this shows the rest.
       */}
      {drawn && layer && view.offerWhole && (
        <button
          ref={wholeButton}
          type="button"
          aria-pressed={whole === layer.id}
          // On a narrow pane only its icon, beside the system's title (its name stays the button's).
          aria-label={narrow ? t('stage.wholeBody') : undefined}
          title={narrow ? t('stage.wholeBody') : undefined}
          onClick={() => setWhole((w) => (w === layer.id ? null : layer.id))}
          className={`absolute top-2 right-3 z-10 inline-flex items-center rounded-control bg-surface-raised/90 text-control font-semibold whitespace-nowrap text-ink shadow-[0_1px_3px_rgb(20_33_61/0.18)] hover:bg-surface-sunk aria-pressed:bg-ink aria-pressed:text-white aria-pressed:hover:bg-ink lg:top-3 lg:right-4 ${narrow ? 'size-11 justify-center lg:size-9' : 'min-h-11 gap-1.5 pr-3 pl-2.5 lg:min-h-9'}`}
        >
          <WholeIcon />
          {!narrow && t('stage.wholeBody')}
        </button>
      )}
      {!drawn && placeholder && <div className="absolute inset-0">{placeholder}</div>}
    </div>
  )
}

/**
 * The 3D body's handles on window (renderer info, camera, scene, a snapshot): for the ?debug=fps
 * readout (docs/PHONE-CHECK.md) and the e2e build (VITE_E2E=1, playwright.config.ts) only.
 */
const TEST_HANDLES =
  import.meta.env.VITE_E2E === '1' || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'fps')

/** Narrower than this (CSS px), the whole-body switch shows only its icon. */
const NARROW_PX = 460

/** The whole-body switch's icon: a standing figure in a frame's corners (the kit's grid and stroke, components/kit/icons.tsx). */
function WholeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d="M3 6.5V3h3.5M13.5 3H17v3.5M17 13.5V17h-3.5M6.5 17H3v-3.5" />
      <circle cx="10" cy="6.4" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 9v3.2m-2 2.8 2-2.8 2 2.8" strokeWidth="1.6" />
    </svg>
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
 * The 3D legs (three/limbs.ts) once a picture needs them, loaded then and kept; null until they are
 * here (the shell stands at rest meanwhile: never a blank body). A chunk that does not arrive leaves
 * the resting shell, and is asked for again the next time legs are needed.
 */
function useLimbs(needed: boolean): Limbs3d | null {
  const [limbs, setLimbs] = useState<Limbs3d | null>(null)
  useEffect(() => {
    if (!needed || limbs) return
    let live = true
    loadLimbs().then(
      (l) => live && setLimbs(l),
      () => {},
    )
    return () => {
      live = false
    }
  }, [needed, limbs])
  return limbs
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
  // A frame the layer asked for later (LayerState.later: its scrub gate held a change back).
  const later = useRef(0)
  useEffect(() => () => window.clearTimeout(later.current), [])
  // Runs before the scene is drawn (priority -1), so the uniforms belong to this frame's time.
  useFrame(() => {
    const t = clock.now()
    const r = layer.rhythm
    if (r) rhythm.hz = reduced ? 0 : r.hz(sim, t)
    layer.write(m.state, sim, t, r ? rhythm.phase : 0, reduced)
    if (m.state.later) {
      window.clearTimeout(later.current)
      later.current = window.setTimeout(redraw, m.state.later)
      m.state.later = 0
    }
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

/** The base every layer shares: the food particles (the resting shell is RestShell's). */
function Base({ tier, sim, clock, reduced, food }: { tier: Tier; sim: RunResult; clock: BodyClock; reduced: boolean; food: boolean }) {
  const b = useMemo(() => mountBase(tier), [tier])
  useEffect(() => {
    pinBase(b)
    return () => releaseBase(b)
  }, [b])
  return (
    <>
      {/* Kept mounted (no shader is rebuilt on a switch back), hidden when the lit layer draws no food. */}
      <group visible={food}>
        <Swarm particles={b.particles} sim={sim} clock={clock} reduced={reduced} hidden={!food} />
      </group>
    </>
  )
}

/** The skin shell standing at rest, its arms hanging (three/geometry.ts buildShell): today's body, with no legs. */
function RestShell({ tier }: { tier: Tier }) {
  const b = useMemo(() => mountBase(tier), [tier])
  useEffect(() => {
    pinBase(b)
    return () => releaseBase(b)
  }, [b])
  return <mesh geometry={b.shell} material={b.shellMaterial} renderOrder={20} dispose={null} />
}

/**
 * The skin shell in the band's still pose, with legs (A-1a). Its nearest surface is drawn into the
 * depth buffer first (the pre-pass, renderOrder 15), so the rim-lit skin draws one outline where its
 * parts overlap (an arm on the torso, a thigh in the hip, the joint caps), never two (plan §1, §10).
 */
function PosedShell({ limbs, tier, band }: { limbs: Limbs3d; tier: Tier; band: ActivityBand }) {
  const p = useMemo(() => mountPosed(limbs, tier, band), [limbs, tier, band])
  useEffect(() => {
    pinPosed(p)
    return () => releasePosed(p)
  }, [p])
  return (
    <>
      {p.prepass && <mesh geometry={p.shell} material={p.prepass} renderOrder={15} dispose={null} />}
      <mesh geometry={p.shell} material={p.shellMaterial} renderOrder={20} dispose={null} />
    </>
  )
}

/**
 * The skeleton ghost (A-1a; plan §1 landmarks): the backbone, ribs, breastbone, hip bones and the long
 * bones in the band's pose, one faint draw just after the organs (an organ in front hides it).
 */
function Ghost({ limbs, band }: { limbs: Limbs3d; band: ActivityBand }) {
  const projector = useProjector()
  const g = useMemo(() => mountGhost(limbs, band, false), [limbs, band])
  useEffect(() => {
    pinGhost(g)
    return () => releaseGhost(g)
  }, [g])
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    g.material.uniforms.uStrength!.value = projector ? GHOST.projector : GHOST.normal
    invalidate()
  }, [g, projector, invalidate])
  return <mesh geometry={g.geometry} material={g.material} renderOrder={2} dispose={null} />
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
  // Its own GPU buffers and program, freed when it goes (R120 #15).
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
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
 *
 * The camera's matrices are brought up to date first (R106). A drag's orbit (the controls' update)
 * and a framing's ease (CameraRig) move and turn the camera in this frame, but its view matrix is
 * only remade when the scene is drawn, after this: the labels were placed for the frame before, so
 * all through a turn every dot trailed its organ (40–60 px in the e2e check's drag) and stopped off it.
 */
function LabelProjector({
  place,
  overlays,
  keptOut,
}: {
  place: Callouts['place']
  overlays: ReadonlySet<Place>
  keptOut: RefObject<readonly (LabelBox | null)[]>
}) {
  const p = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    const project: Project = (v) => {
      p.copy(v).project(camera)
      return p.z > 1 ? null : [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
    }
    const boxes = keptOut.current.filter((k): k is LabelBox => !!k)
    place(
      project,
      size.width,
      size.height,
      boxes.length ? (b) => boxes.some((k) => b.x < k.x + k.w && b.x + b.w > k.x && b.y < k.y + k.h && b.y + b.h > k.y) : undefined,
    )
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
  const { reduced, t, rhythm, register, keepOut } = props
  useEffect(() => {
    const stop = host.current ? layer.overlay?.(host.current, { reduced, t, rhythm, register, keepOut }) : undefined
    return () => {
      stop?.()
      keepOut(null)
    }
  }, [layer, reduced, t, rhythm, register, keepOut])
  // Not hidden from screen readers: a layer's words (the heart's colour key) are read as the flat
  // drawing's; its pictures (the air dashes, the still arrows) hide themselves.
  return <div ref={host} className="pointer-events-none absolute inset-0" />
}

/** How long the camera takes to a new framing (anatomy plan §1; a cut with motion reduced). */
const EASE_MS = 600

/**
 * Moves the camera to the view's goal (three/framing.ts: the lit layer's framing, the phone's close-up
 * or the whole body): at once for the first view (and with motion reduced), else eased over EASE_MS.
 * The way the camera faces (a drag's orbit) is kept; only where it looks and how far away it is
 * change. Runs before the controls' own update (priority -2).
 */
function CameraRig({
  goal,
  reduced,
  controls,
}: {
  goal: CameraGoal
  reduced: boolean
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>
}) {
  const key = `${goal.y}:${goal.distance}`
  const shown = useRef<string | null>(null)
  const ease = useRef<{ y: number; distance: number; start: number } | null>(null)
  const dir = useMemo(() => new Vector3(), [])
  // A new goal draws a frame (the scene may not change with it: the whole-body switch at rest in `full`).
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [key, invalidate])
  useFrame(({ camera, invalidate }) => {
    const c = controls.current
    if (!c) return
    const put = (y: number, distance: number) => {
      dir.subVectors(camera.position, c.target).normalize()
      c.target.set(0, y, 0)
      camera.position.copy(c.target).addScaledVector(dir, distance)
    }
    if (shown.current !== key) {
      const first = shown.current === null
      shown.current = key
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
