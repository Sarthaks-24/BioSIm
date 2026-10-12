import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Color, DoubleSide, Euler, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3, type BufferGeometry } from 'three'
import { NUTRIENT_KINDS, activeStage, type NutrientKind, type Simulation, type StageId } from '@biosim/engine'
import { useSim } from '../state/sim.ts'
import { LIVER, PANCREAS, STAGE_LABEL_ANCHOR, particlePosition } from '../anatomy/anatomy.ts'
import { sharedGeometry } from './geometry.ts'
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
      camera={{ position: [0, 0.5, 7.6], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-label={label}
      role="img"
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />
      <directionalLight position={[-4, -2, 3]} intensity={0.4} />
      <Body sim={sim} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={11}
        target={[0, 0.55, 0]}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
      <Invalidator sim={sim} />
    </Canvas>
  )
}

/** Re-render the canvas whenever simulated time or the meal changes. */
function Invalidator({ sim }: { sim: Simulation }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => useSim.subscribe((s, prev) => s.time !== prev.time && invalidate()), [invalidate])
  useEffect(() => invalidate(), [sim, invalidate])
  return null
}

const rimMaterial = (color: string, strength: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uColor: { value: new Color(color) }, uStrength: { value: strength } },
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
        gl_FragColor = vec4(uColor, pow(rim, 2.2) * uStrength + 0.025);
      }`,
  })

function Body({ sim }: { sim: Simulation }) {
  const geo = sharedGeometry()
  const time = useSim((s) => Math.round(s.time))
  const stage = activeStage(sim, time)
  const skin = useMemo(() => rimMaterial('#46536e', 0.55), [])

  return (
    <group>
      <mesh geometry={geo.torso} material={skin} renderOrder={10} />
      <mesh geometry={geo.head} material={skin} renderOrder={10} />

      <mesh position={LIVER.center} scale={LIVER.scale} rotation={[0, 0, -0.25]}>
        <primitive object={geo.liver} attach="geometry" />
        <meshStandardMaterial color="#8c3b36" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={PANCREAS.center} scale={PANCREAS.scale} rotation={[0, 0, 0.15]}>
        <primitive object={geo.pancreas} attach="geometry" />
        <meshStandardMaterial color="#d8b25a" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      <Organ stage="esophagus" active={stage === 'esophagus'} geometry={geo.esophagus} />
      <Organ stage="stomach" active={stage === 'stomach'} geometry={geo.stomach} />
      <Organ stage="smallIntestine" active={stage === 'smallIntestine'} geometry={geo.smallIntestine} />
      <Organ stage="largeIntestine" active={stage === 'largeIntestine'} geometry={geo.largeIntestine} />

      <Swarm sim={sim} />
      <Labels active={stage} />
    </group>
  )
}

function Organ({ stage, active, geometry }: { stage: StageId; active: boolean; geometry: BufferGeometry }) {
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        color={ORGAN_COLOR[stage]}
        emissive={ORGAN_COLOR[stage]}
        emissiveIntensity={active ? 0.35 : 0}
        transparent
        opacity={active ? 0.55 : 0.28}
        roughness={0.55}
        depthWrite={false}
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
            renderOrder={5}
            frustumCulled={false}
          >
            <meshStandardMaterial
              color={NUTRIENT_COLOR[kind]}
              emissive={NUTRIENT_COLOR[kind]}
              emissiveIntensity={0.35}
              roughness={0.4}
              transparent={kind === 'water'}
              opacity={kind === 'water' ? 0.7 : 1}
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
  return (
    <>
      {LABEL_STAGES.filter((s) => !compact || s === active).map((s) => (
        <Html key={s} position={STAGE_LABEL_ANCHOR[s]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className={`block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] leading-tight shadow-sm transition-colors ${
              s === active ? 'bg-ink text-white font-semibold' : 'bg-panel/85 text-ink-2'
            }`}
          >
            {t(`stages.${s}.name`)}
          </span>
        </Html>
      ))}
    </>
  )
}
