import { BackSide, Color, FrontSide, MeshStandardMaterial, ShaderMaterial, type IUniform } from 'three'
import { FADE_TONE } from '../anatomy/tones.ts'
import { ORGANS } from './geometry.ts'

/**
 * Materials of the 3D body (plan-systems-3d §3.1, roadmap 3D-1):
 * - the lit layer is opaque, one-sided and writes depth, so organs never show through each other
 *   or sort wrongly, and a phone draws each pixel about once;
 * - MeshStandardMaterial, no clearcoat, no environment map; a fresnel rim gives tissue its soft
 *   edge, and a back-face "inverted hull" draws a soft ink outline for projectors;
 * - the skin is a rim-only ghost.
 * Shader code is injected with onBeforeCompile, so three.js keeps its own lighting.
 */

/** Uniforms shared by the organs and their outline, written per frame from the body state. */
export interface LayerUniforms {
  /** Stomach stretch, 0…1 (anatomy stomachFill). */
  uFill: IUniform<number>
  /** Per organ (ORGANS order): −1 = empty, faded back; 0 = normal; 1 = the active stage. */
  uState: IUniform<number[]>
  /** Outline width as a share of the distance to the camera (constant on screen). */
  uOutline: IUniform<number>
}

export const layerUniforms = (): LayerUniforms => ({
  uFill: { value: 0 },
  uState: { value: ORGANS.map(() => 0) },
  uOutline: { value: 0.0016 },
})

const N = ORGANS.length

const FADE = new Color(FADE_TONE)

export function tissueMaterial(u: LayerUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, side: FrontSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = u.uFill
    shader.uniforms.uState = u.uState
    shader.uniforms.uFade = { value: FADE }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float organ;
        attribute float inflate;
        uniform float uFill;
        varying float vOrgan;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += objectNormal * inflate * uFill;
        vOrgan = organ;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uState[${N}];
        uniform vec3 uFade;
        varying float vOrgan;
        float organState() { return uState[int(vOrgan + 0.5)]; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lpState = organState();
        float lpFaded = max(0.0, -lpState);
        float lpActive = max(0.0, lpState);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFade * (0.78 + 0.22 * diffuseColor.rgb / max(0.001, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)))), lpFaded * 0.5);`,
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
  // Same program for every body on the page.
  m.customProgramCacheKey = () => 'lifepeek-tissue'
  return m
}

/**
 * Inverted hull: the organs' back faces, pushed out along the normal by a fixed share of the
 * camera distance, in a dark shade of each organ's own colour. Where an organ's edge meets the
 * paper or another organ, a thin outline shows. Faded organs get a fainter line.
 */
export function outlineMaterial(u: LayerUniforms): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    vertexColors: true,
    uniforms: { uFill: u.uFill, uState: u.uState, uOutline: u.uOutline, uFade: { value: FADE } },
    vertexShader: /* glsl */ `
      attribute float organ;
      attribute float inflate;
      uniform float uFill;
      uniform float uOutline;
      uniform float uState[${N}];
      varying vec3 vInk;
      varying float vFaded;
      void main() {
        vec3 p = position + normal * inflate * uFill;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * uOutline * -mv.z;
        gl_Position = projectionMatrix * mv;
        vFaded = max(0.0, -uState[int(organ + 0.5)]);
        vInk = color;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFade;
      varying vec3 vInk;
      varying float vFaded;
      void main() {
        // A deep shade of the organ's own colour, not black: soft, and still 3:1 on the paper.
        vec3 ink = vInk * 0.3 + vec3(0.012, 0.016, 0.03);
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
      outgoingLight = mix(outgoingLight, vec3(0.03, 0.04, 0.09), smoothstep(0.35, 0.8, edge));
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => 'lifepeek-particle'
  return m
}
