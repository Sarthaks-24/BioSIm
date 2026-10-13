import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
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
import { useBodyClock, type BodyClock } from '../hooks/useBodyClock.ts'
import { particlePosition, tumble } from '../anatomy/human.ts'
import { bodyStateAt } from '../anatomy/bodyState.ts'
import { useCalloutSpecs, useCallouts, type Callouts, type Project } from '../anatomy/CalloutOverlay.tsx'
import { useMotion } from '../state/motion.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { NUTRIENT_COLOR } from '../lib/colors.ts'
import { ORGANS, sharedGeometry } from './geometry.ts'
import {
  layerUniforms,
  outlineMaterial,
  particleMaterial,
  setLook,
  shellMaterial,
  tissueMaterial,
  type LayerUniforms,
} from './materials.ts'
import { quality } from './quality.ts'

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
export default function BodyCanvas({ sim, label, onContextLost, placeholder }: Props) {
  // Read outside <Canvas> and passed down, so the scene does not depend on context bridging.
  const clock = useBodyClock()
  const stage = useStage(sim, clock)
  const reduced = useMotion((s) => s.reduced)
  const q = useMemo(() => quality(), [])
  const [width, setWidth] = useState(0)
  const invalidate = useRef<() => void>(() => {})
  const { overlay, place } = useCallouts(useCalloutSpecs(stage, width), () => invalidate.current())
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const settled = useSettled(wrapper)
  const [drawn, setDrawn] = useState(false)

  return (
    // data-particles says whether the food tumbles (reduced motion: "still"); the reduced-motion test reads it.
    <div
      className="relative h-full w-full"
      ref={wrapper}
      data-body="3d"
      data-ready={drawn ? '' : undefined}
      data-particles={reduced ? 'still' : 'tumbling'}
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
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              onContextLost?.()
            })
            // The ?debug=fps overlay (BodyView) reads draw calls and triangles from here; the e2e
            // label check projects the organs itself, with the camera.
            Object.assign(window, { __lifepeekGl: gl.info, __lifepeekCamera: camera })
          }}
        >
          <Lighting />
          <Body sim={sim} clock={clock} reduced={reduced} />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={3.5}
            maxDistance={11}
            target={[0, 0.8, 0]}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
          />
          <LabelProjector place={place} />
          <Invalidator sim={sim} clock={clock} reduced={reduced} />
          <FirstFrame onDrawn={() => setDrawn(true)} />
        </Canvas>
      )}
      {/* Measured from the start (hidden, not removed), placed by the 3D body's frames. */}
      <div style={drawn ? undefined : { opacity: 0 }}>{overlay}</div>
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

/** Organ highlight per frame: −1 faded (empty), 0 normal, 1 where the meal is now. */
function writeState(u: LayerUniforms, sim: RunResult, t: number) {
  const s = bodyStateAt(sim, t)
  u.uFill.value = s.stomachFill
  const state = u.uState.value
  for (let i = 0; i < ORGANS.length; i++) {
    const organ = ORGANS[i]!
    switch (organ) {
      case 'esophagus':
        state[i] = s.stage === 'mouth' || s.stage === 'esophagus' ? 1 : 0
        break
      case 'stomach':
      case 'smallIntestine':
      case 'largeIntestine':
        state[i] = s.stage === organ ? 1 : s.holds[organ] ? 0 : -1
        break
      default:
        state[i] = 0
    }
  }
}

function Body({ sim, clock, reduced }: { sim: RunResult; clock: BodyClock; reduced: boolean }) {
  const geo = sharedGeometry()
  const mats = useMemo(() => {
    const u = layerUniforms()
    return { u, tissue: tissueMaterial(u), outline: outlineMaterial(u), shell: shellMaterial() }
  }, [])
  useEffect(
    () => () => {
      mats.tissue.dispose()
      mats.outline.dispose()
      mats.shell.dispose()
    },
    [mats],
  )
  // Runs before the scene is drawn (priority -1), so the uniforms belong to this frame's time.
  useFrame(() => writeState(mats.u, sim, clock.now()), -1)
  // The projector look (3D-5): wider, near-black outlines, less fade. Same shaders, new uniforms.
  const projector = useProjector()
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    setLook(mats.u, projector ? 'projector' : 'normal')
    invalidate()
  }, [mats, projector, invalidate])

  return (
    <group>
      <mesh geometry={geo.digestion} material={mats.tissue} />
      <mesh geometry={geo.digestion} material={mats.outline} />
      <mesh geometry={geo.shell} material={mats.shell} renderOrder={20} />
      <Swarm sim={sim} clock={clock} reduced={reduced} />
    </group>
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

function Swarm({ sim, clock, reduced }: { sim: RunResult; clock: BodyClock; reduced: boolean }) {
  const geo = sharedGeometry()
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
            args={[geo.particles[kind], materials[kind], byKind[kind].length]}
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
function LabelProjector({ place }: { place: Callouts['place'] }) {
  const p = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const project: Project = (v) => {
      p.copy(v).project(camera)
      return p.z > 1 ? null : [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
    }
    place(project, size.width, size.height)
  })
  return null
}
