import { Color, SphereGeometry, Vector3 } from 'three'
import { layerGeometry, organTube, sculpt } from './geometry.ts'

/**
 * What a lazy 3D layer (three/layers/<system>.ts, A-3 on) borrows from the 3D body to build its mesh:
 * three.js's few classes it needs and the geometry kit (geometry.ts). three/mount.ts hands it to
 * `Layer3d.build`, so the layer's chunk imports nothing of the 3D body: a module both chunks
 * imported would be cut out of the 3D body's chunk into a shared one, and the cut alone costs the
 * first 3D view ≈ 2.5 KB gz (measured on A-3), as the flat layers' kit (flat/layerKit.ts) avoids for /sim.
 */
export const KIT_3D = { Color, SphereGeometry, Vector3, layerGeometry, organTube, sculpt }
export type Kit3d = typeof KIT_3D
