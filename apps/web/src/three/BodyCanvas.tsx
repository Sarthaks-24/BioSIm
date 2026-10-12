import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { NUTRIENT_KINDS, activeStage, type NutrientKind, type Simulation, type StageId } from '@lifepeek/engine'
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

interface Props {
  sim: Simulation
  /** Accessible description of what the picture shows. */
  label: string
  /** Called if the GPU drops the WebGL context (common on cheap phones); the parent shows the flat view instead. */
  onContextLost?: () => void
}

/**
 * One stylized body for one meal. Renders only when something changes (frameloop "demand"): the
 * clock moving (playing or scrubbing), the meal, the motion setting, a drag. A paused page draws
 * nothing, which saves a school laptop's battery and a cheap phone's heat.
 */
export default function BodyCanvas({ sim, label, onContextLost }: Props) {
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

  return (
    // data-particles says whether the food tumbles (reduced motion: "still"); the reduced-motion test reads it.
    <div className="relative h-full w-full" ref={wrapper} data-body="3d" data-particles={reduced ? 'still' : 'tumbling'}>
      <Canvas
        frameloop="demand"
        dpr={[1, q.dpr]}
        camera={{ position: [0, 0.7, 8.9], fov: 32 }}
        gl={{ antialias: q.antialias, alpha: true, powerPreference: 'low-power' }}
        aria-label={label}
        role="img"
        onCreated={({ gl, invalidate: redraw }) => {
          invalidate.current = () => redraw()
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            onContextLost?.()
          })
          // The ?debug=fps overlay (BodyView) reads draw calls and triangles from here.
          ;(window as { __lifepeekGl?: unknown }).__lifepeekGl = gl.info
        }}
      >
        <Lighting />
        <Body sim={sim} clock={clock} reduced={reduced} />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={3.5}
          maxDistance={11}
          target={[0, 0.7, 0]}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.8}
        />
        <LabelProjector place={place} />
        <Invalidator sim={sim} clock={clock} reduced={reduced} />
      </Canvas>
      {overlay}
    </div>
  )
}

/**
 * Where most of the meal is now. Re-renders only when that changes (a few times per meal), not
 * every sim minute while playing.
 */
function useStage(sim: Simulation, clock: BodyClock): StageId {
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
function Invalidator({ sim, clock, reduced }: { sim: Simulation; clock: BodyClock; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate])
  useEffect(() => invalidate(), [sim, reduced, invalidate])
  return null
}

/** Organ highlight per frame: −1 faded (empty), 0 normal, 1 where the meal is now. */
function writeState(u: LayerUniforms, sim: Simulation, t: number) {
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

function Body({ sim, clock, reduced }: { sim: Simulation; clock: BodyClock; reduced: boolean }) {
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

function Swarm({ sim, clock, reduced }: { sim: Simulation; clock: BodyClock; reduced: boolean }) {
  const geo = sharedGeometry()
  const meshes = useRef<Partial<Record<NutrientKind, InstancedMesh>>>({})
  const materials = useMemo(() => Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, particleMaterial(NUTRIENT_COLOR[k])])), []) as Record<
    NutrientKind,
    ReturnType<typeof particleMaterial>
  >
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  const byKind = useMemo(() => {
    const groups = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, [] as Simulation['particles']])) as Record<
      NutrientKind,
      Simulation['particles']
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

/** Moves the organ labels to where their organs are on screen, every frame the scene draws. */
function LabelProjector({ place }: { place: Callouts['place'] }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const p = useMemo(() => new Vector3(), [])
  const project: Project = (v) => {
    p.copy(v).project(camera)
    return p.z > 1 ? null : [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
  }
  useFrame(() => place(project, size.width, size.height))
  return null
}
