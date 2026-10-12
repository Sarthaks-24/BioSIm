import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Color,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  PMREMGenerator,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { NUTRIENT_KINDS, activeStage, indexAt, type NutrientKind, type Simulation, type StageId } from '@biosim/engine'
import { useSim } from '../state/sim.ts'
import { STAGE_LABEL_ANCHOR, STOMACH, particlePosition } from '../anatomy/anatomy.ts'
import { pylorusTransform, sharedGeometry } from './geometry.ts'
import { NUTRIENT_COLOR, ORGAN_COLOR } from '../lib/colors.ts'

interface Props {
  sim: Simulation
  /** Accessible description of what the picture shows. */
  label: string
}

/**
 * One stylized body for one meal. Renders only when something changes (frameloop "demand"),
 * so a paused simulation costs nothing on a school laptop's battery.
 */
export default function BodyCanvas({ sim, label }: Props) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.7, 8.9], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-label={label}
      role="img"
      onCreated={(state) => {
        if (import.meta.env.DEV) ((window as unknown as { __scenes?: unknown[] }).__scenes ??= []).push(state.scene)
      }}
    >
      <Lighting />
      <Body sim={sim} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={3.5}
        maxDistance={11}
        target={[0, 0.7, 0]}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
      <Invalidator sim={sim} />
    </Canvas>
  )
}

/** Soft studio light from a procedural room — no HDR download, so it works offline. */
function Lighting() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 6]} intensity={1.2} />
      <directionalLight position={[-4, -1, 2]} intensity={0.35} color="#cfe3ff" />
    </>
  )
}

/** Re-render the canvas whenever simulated time or the meal changes. */
function Invalidator({ sim }: { sim: Simulation }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => useSim.subscribe((s, prev) => s.time !== prev.time && invalidate()), [invalidate])
  useEffect(() => invalidate(), [sim, invalidate])
  return null
}

/** X-ray style skin: transparent face-on, visible at the silhouette edges. */
const skinMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uColor: { value: new Color('#3d4c6b') }, uStrength: { value: 0.6 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        gl_FragColor = vec4(uColor, pow(rim, 2.4) * uStrength + 0.03);
      }`,
  })

/** Centre the stomach scales around, so it swells and shrinks in place. */
const STOMACH_PIVOT = STOMACH.getPointAt(0.45)

function Body({ sim }: { sim: Simulation }) {
  const geo = sharedGeometry()
  const minute = useSim((s) => Math.round(s.time))
  const stage = activeStage(sim, minute)
  const skin = useMemo(skinMaterial, [])
  const pylorus = useMemo(() => {
    const { pos, tan } = pylorusTransform()
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tan)
    return { pos, q }
  }, [])

  // A full stomach is visibly bigger than an empty one (≈ 0.85× empty → 1.15× after a big meal).
  const i = indexAt(sim, minute)
  const inStomach = sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!
  const swell = 0.86 + 0.3 * Math.min(1, inStomach / 650)

  return (
    <group>
      <mesh geometry={geo.body} material={skin} renderOrder={20} />

      <Tissue geometry={geo.liver} color="#7b2d2a" opacity={0.4} />
      <Tissue geometry={geo.gallbladder} color="#5f8a3c" opacity={0.45} />
      <Tissue geometry={geo.spleen} color="#7a2f45" opacity={0.3} />
      <Tissue geometry={geo.pancreas} color="#e2b45f" opacity={0.5} />
      <Tissue geometry={geo.appendix} color={ORGAN_COLOR.largeIntestine} opacity={0.45} />

      <Tissue geometry={geo.pharynx} color={ORGAN_COLOR.esophagus} stage="esophagus" active={stage === 'mouth' || stage === 'esophagus'} />
      <Tissue geometry={geo.esophagus} color={ORGAN_COLOR.esophagus} stage="esophagus" active={stage === 'esophagus'} />
      <group position={STOMACH_PIVOT} scale={swell}>
        <group position={STOMACH_PIVOT.clone().negate()}>
          <Tissue geometry={geo.stomach} color={ORGAN_COLOR.stomach} stage="stomach" active={stage === 'stomach'} />
        </group>
      </group>
      <mesh geometry={geo.pylorus} position={pylorus.pos} quaternion={pylorus.q}>
        <meshStandardMaterial color="#b2445a" roughness={0.5} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Tissue geometry={geo.smallIntestine} color={ORGAN_COLOR.smallIntestine} stage="smallIntestine" active={stage === 'smallIntestine'} />
      <Tissue geometry={geo.largeIntestine} color={ORGAN_COLOR.largeIntestine} stage="largeIntestine" active={stage === 'largeIntestine'} />

      <Swarm sim={sim} />
      <Labels active={stage} />
    </group>
  )
}

/** Wet-looking tissue: a clear-coated, translucent physical material. */
function Tissue({
  geometry,
  color,
  opacity,
  stage,
  active = false,
}: {
  geometry: BufferGeometry
  color: string
  opacity?: number
  stage?: StageId
  active?: boolean
}) {
  const base = opacity ?? (active ? 0.62 : 0.34)
  return (
    <mesh geometry={geometry} renderOrder={stage ? 2 : 1}>
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 0.32 : 0.04}
        roughness={0.38}
        clearcoat={0.7}
        clearcoatRoughness={0.25}
        envMapIntensity={0.7}
        transparent
        opacity={base}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

const tmpPos = new Vector3()
const tmpScale = new Vector3()
const tmpQuat = new Quaternion()
const tmpEuler = new Euler()
const tmpMatrix = new Matrix4()

function Swarm({ sim }: { sim: Simulation }) {
  const geo = sharedGeometry()
  const meshes = useRef<Partial<Record<NutrientKind, InstancedMesh>>>({})
  const byKind = useMemo(() => {
    const groups = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, [] as Simulation['particles']])) as Record<
      NutrientKind,
      Simulation['particles']
    >
    for (const p of sim.particles) groups[p.kind].push(p)
    return groups
  }, [sim])

  useFrame(() => {
    const t = useSim.getState().time
    for (const kind of NUTRIENT_KINDS) {
      const mesh = meshes.current[kind]
      if (!mesh) continue
      const list = byKind[kind]
      for (let i = 0; i < list.length; i++) {
        const p = list[i]!
        const s = particlePosition(p, t, tmpPos)
        tmpEuler.set(p.seed[0] * 6.28, p.seed[1] * 6.28 + t * 0.01, p.seed[2] * 6.28)
        tmpQuat.setFromEuler(tmpEuler)
        tmpScale.setScalar(s)
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
        mesh.setMatrixAt(i, tmpMatrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {NUTRIENT_KINDS.map((kind) =>
        byKind[kind].length === 0 ? null : (
          <instancedMesh
            key={`${kind}-${byKind[kind].length}`}
            ref={(m) => {
              meshes.current[kind] = m ?? undefined
            }}
            args={[geo.particles[kind], undefined, byKind[kind].length]}
            renderOrder={10}
            frustumCulled={false}
          >
            <meshStandardMaterial
              color={NUTRIENT_COLOR[kind]}
              emissive={NUTRIENT_COLOR[kind]}
              emissiveIntensity={0.45}
              roughness={0.35}
              transparent={kind === 'water'}
              opacity={kind === 'water' ? 0.75 : 1}
            />
          </instancedMesh>
        ),
      )}
    </>
  )
}

const LABEL_STAGES: StageId[] = ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine']

function Labels({ active }: { active: StageId }) {
  const { t } = useTranslation()
  const width = useThree((s) => s.size.width)
  const compact = width < 340
  const roomy = width >= 460
  const pill = 'block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] leading-tight shadow-sm'
  return (
    <>
      {/* Labels stay mounted and are hidden with CSS: mounting/unmounting drei <Html> while the
          canvas renders makes React warn about unmounting a root mid-render. */}
      {LABEL_STAGES.map((s) => (
        <Html key={s} position={STAGE_LABEL_ANCHOR[s]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span
            hidden={compact && s !== active}
            className={`${pill} ${s === active ? 'bg-ink font-semibold text-white' : 'bg-panel/85 text-ink-2'}`}
          >
            {t(`stages.${s}.name`).replace(/\s*\(.*\)/, '')}
          </span>
        </Html>
      ))}
      <Html position={[-0.7, 1.3, 0.1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span hidden={!roomy} className={`${pill} bg-panel/70 text-ink-2`}>
          {t('anatomy.liver')}
        </span>
      </Html>
      <Html position={[0.36, 0.3, -0.1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span hidden={!roomy} className={`${pill} bg-panel/70 text-ink-2`}>
          {t('anatomy.pancreas')}
        </span>
      </Html>
    </>
  )
}
