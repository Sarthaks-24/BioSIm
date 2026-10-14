import { BackSide, Color, FrontSide, MeshStandardMaterial, ShaderMaterial, Vector3, type IUniform } from 'three'
import { FADE_TONE, PARTICLE_EDGE } from '../anatomy/tones/base.ts'
import { BODY_LOOK, linearRgb, type BodyLook } from './look.ts'

/**
 * Materials of the 3D body (plan-systems-3d §3.1, roadmap 3D-1):
 * - the lit layer is opaque, one-sided and writes depth, so organs never show through each other
 *   or sort wrongly, and a phone draws each pixel about once;
 * - MeshStandardMaterial, no clearcoat, no environment map; a fresnel rim gives tissue its soft
 *   edge, and a back-face "inverted hull" draws a soft ink outline for projectors;
 * - the skin is a rim-only ghost.
 * Shader code is injected with onBeforeCompile, so three.js keeps its own lighting.
 */

/**
 * Uniforms shared by a layer's organs and their outline, written per frame from the body state.
 * Both arrays have one slot per organ (Layer3d.organs order); the shaders are sized by that count.
 */
export interface LayerUniforms {
  /** Per organ, how far it is stretched, 0…1 (stomach: anatomy stomachFill; lungs and bladder later). */
  uFill: IUniform<number[]>
  /** Per organ: −1 = empty, faded back; 0 = normal; 1 = the active stage. */
  uState: IUniform<number[]>
  /** Outline width as a share of the distance to the camera (constant on screen). */
  uOutline: IUniform<number>
  /** How far an empty organ fades (BODY_LOOK.fade). */
  uFadeAmount: IUniform<number>
  /** Outline = organ colour × uShade + uLift, linear RGB (BODY_LOOK, outlineInk). */
  uShade: IUniform<number>
  uLift: IUniform<Vector3>
}

export const layerUniforms = (organs: number): LayerUniforms => {
  const u: LayerUniforms = {
    uFill: { value: new Array<number>(organs).fill(0) },
    uState: { value: new Array<number>(organs).fill(0) },
    uOutline: { value: 0 },
    uFadeAmount: { value: 0 },
    uShade: { value: 0 },
    uLift: { value: new Vector3() },
  }
  setLook(u, 'normal')
  return u
}

/** Switches the organs between the normal and the projector look (3D-5); no new shader. */
export function setLook(u: LayerUniforms, look: BodyLook) {
  const l = BODY_LOOK[look]
  u.uOutline.value = l.outlineWidth
  u.uFadeAmount.value = l.fade
  u.uShade.value = l.outlineShade
  u.uLift.value.fromArray(l.outlineLift)
}

const FADE = new Color(FADE_TONE)

/**
 * The lit tissue of one layer. `key` is the layer's id: its program is its own (the organ count is
 * baked into the shader), shared only by bodies showing the same layer.
 */
export function tissueMaterial(u: LayerUniforms, key: string): MeshStandardMaterial {
  const N = u.uState.value.length
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, side: FrontSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = u.uFill
    shader.uniforms.uState = u.uState
    shader.uniforms.uFade = { value: FADE }
    shader.uniforms.uFadeAmount = u.uFadeAmount
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float organ;
        attribute float inflate;
        uniform float uFill[${N}];
        varying float vOrgan;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += objectNormal * inflate * uFill[int(organ + 0.5)];
        vOrgan = organ;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uState[${N}];
        uniform vec3 uFade;
        uniform float uFadeAmount;
        varying float vOrgan;
        float organState() { return uState[int(vOrgan + 0.5)]; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lpState = organState();
        float lpFaded = max(0.0, -lpState);
        float lpActive = max(0.0, lpState);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFade * (0.78 + 0.22 * diffuseColor.rgb / max(0.001, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)))), lpFaded * uFadeAmount);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// Fresnel rim: wet tissue catches light at its edges. Brighter on the active organ.
        float facing = saturate(dot(normalize(normal), normalize(vViewPosition)));
        float rim = pow(1.0 - facing, 2.5);
        outgoingLight += mix(diffuseColor.rgb, vec3(1.0), 0.55) * rim * (0.32 + 0.25 * lpActive) * (1.0 - 0.6 * lpFaded);
        // The active organ glows a little from within, so it reads as "here" even in grey light.
        outgoingLight += diffuseColor.rgb * lpActive * 0.16;
        #include <opaque_fragment>`,
      )
  }
  // One program per layer, shared by every body on the page that shows it.
  m.customProgramCacheKey = () => `lifepeek-tissue:${key}:${N}`
  return m
}

/**
 * Inverted hull: the organs' back faces, pushed out along the normal by a fixed share of the
 * camera distance, in a dark shade of each organ's own colour. Where an organ's edge meets the
 * paper or another organ, a thin outline shows. Faded organs get a fainter line. On the
 * projector the line is wider and near-black (setLook).
 */
export function outlineMaterial(u: LayerUniforms): ShaderMaterial {
  const N = u.uState.value.length
  return new ShaderMaterial({
    side: BackSide,
    vertexColors: true,
    uniforms: { uFill: u.uFill, uState: u.uState, uOutline: u.uOutline, uShade: u.uShade, uLift: u.uLift, uFade: { value: FADE } },
    vertexShader: /* glsl */ `
      attribute float organ;
      attribute float inflate;
      uniform float uFill[${N}];
      uniform float uOutline;
      uniform float uState[${N}];
      varying vec3 vInk;
      varying float vFaded;
      void main() {
        vec3 p = position + normal * inflate * uFill[int(organ + 0.5)];
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * uOutline * -mv.z;
        gl_Position = projectionMatrix * mv;
        vFaded = max(0.0, -uState[int(organ + 0.5)]);
        vInk = color;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFade;
      uniform float uShade;
      uniform vec3 uLift;
      varying vec3 vInk;
      varying float vFaded;
      void main() {
        // A deep shade of the organ's own colour: soft, and still 3:1 on the paper; near-black on
        // the projector (outlineInk in three/look.ts is the same sum, for the colour audit).
        vec3 ink = vInk * uShade + uLift;
        gl_FragColor = vec4(mix(ink, uFade * 0.62, vFaded * 0.75), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/** X-ray style skin: transparent face-on, visible at the silhouette edges. Front faces only. */
export const shellMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    uniforms: { uColor: { value: new Color('#3d4c6b') }, uStrength: { value: 0.62 } },
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
        gl_FragColor = vec4(uColor, pow(rim, 2.6) * uStrength + 0.035);
        #include <colorspace_fragment>
      }`,
  })

/** PARTICLE_EDGE in linear RGB, as GLSL numbers. */
const EDGE = linearRgb(PARTICLE_EDGE)
  .map((c) => c.toFixed(4))
  .join(', ')

/**
 * Food particles: a standard material with a dark fresnel edge in the same pass (plan §3.5: one
 * draw per nutrient instead of a fill and an outline pass). The edge keeps a pale particle
 * readable on pale tissue and on the paper.
 */
export function particleMaterial(color: string): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.35 })
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float edge = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.0);
      outgoingLight = mix(outgoingLight, vec3(${EDGE}), smoothstep(0.35, 0.8, edge));
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => 'lifepeek-particle'
  return m
}
