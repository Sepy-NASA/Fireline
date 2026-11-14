/* ————————————————————————————————————————————————————————————
   Synthetic axisymmetric emission field ε(z, r) for the VR flame
   visualization.

   The repo ships no PSI-159 LUT / TIFF / HOBJ payloads, so this
   module synthesizes a *plausible* microgravity flame as a stand-in.
   It is MOCK data, not a measured PSI-159 reconstruction:

   • CFI-G "inverse" flame  → a spherical flame shell around a central
     oxygen burner (the "ghostly blue sphere" from the task brief).
   • normal-gravity profile → a teardrop (buoyant) flame, optional.

   Geometry follows the renderer mapping (see flameShader.ts):
     texture.x = r = 2·length(p.xz)         → radial, 0..1
     texture.y = v = 0.5 − p.y              → axial, 0 (top) .. 1 (bottom)
   so world radius = r/2 (box half-width 0.5) and world height spans 1.0.
   ———————————————————————————————————————————————————————————— */

export const LUT_Z = 256 // axial rows
export const LUT_R = 128 // radial columns (r fastest)

export type FlameProfile = 'spherical' | 'teardrop'

export interface FlameFrame {
  index: number
  /** time in ms from sequence start */
  tMs: number
  /** ε(z,r), length LUT_Z·LUT_R, uint8, row-major with r fastest */
  data: Uint8Array
}

export interface FlameSequence {
  profile: FlameProfile
  frames: FlameFrame[]
  fps: number
  /** normalization ceiling used across the whole sequence (raw value ≈ 255) */
  globalMax: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** smoothstep envelope for ignition → sustain → extinction */
function lifecycle(u: number): number {
  const rampUp = clamp01(u / 0.08)
  const rampDown = clamp01((1 - u) / 0.18)
  const s = (x: number) => x * x * (3 - 2 * x)
  return s(rampUp) * s(rampDown)
}

const gauss = (d: number, sigma: number) => Math.exp(-(d * d) / (2 * sigma * sigma))

export interface FlameFieldOptions {
  profile?: FlameProfile
  frameCount?: number
  fps?: number
  /** burner shell radius, world units (box half-width 0.5) */
  shellRadius?: number
}

/**
 * Generate the full frame sequence. Values are normalized against one
 * global ceiling so brightness stays comparable across frames (unlike a
 * per-frame percentile stretch, which would destroy cross-frame meaning).
 */
export function generateFlameSequence(opts: FlameFieldOptions = {}): FlameSequence {
  const profile = opts.profile ?? 'spherical'
  const frameCount = opts.frameCount ?? 120
  const fps = opts.fps ?? 23
  const shellRadius = opts.shellRadius ?? (profile === 'teardrop' ? 0.24 : 0.26)

  const n = LUT_Z * LUT_R
  const raw: Float32Array[] = []
  const envelopes: number[] = []

  for (let f = 0; f < frameCount; f++) {
    const u = frameCount === 1 ? 0.5 : f / (frameCount - 1) // 0..1 over sequence
    const t = f / fps // seconds
    const env = lifecycle(u)
    envelopes.push(env)

    // low-frequency breathing + a little high-frequency flicker
    const breathing = 1 + 0.07 * Math.sin(2 * Math.PI * 0.55 * t + 0.4)
    const flicker =
      1 +
      0.09 * Math.sin(2 * Math.PI * 3.4 * t + 1.7) * Math.sin(2 * Math.PI * 1.1 * t + 0.2)
    const wobble = 1 + 0.045 * Math.sin(2 * Math.PI * 2.1 * t + 0.9)
    const amp = env * breathing * flicker

    const rs = shellRadius * wobble
    const sigma = shellRadius * (0.34 + 0.02 * Math.sin(2 * Math.PI * 2.6 * t))

    const frame = new Float32Array(n)
    for (let z = 0; z < LUT_Z; z++) {
      const v = z / (LUT_Z - 1) // 0 top .. 1 bottom
      const y = 0.5 - v // world axial, +0.5 top .. −0.5 bottom
      for (let r = 0; r < LUT_R; r++) {
        const wr = (r / (LUT_R - 1)) * 0.5 // world radial 0..0.5
        let d = Math.hypot(wr, y)

        if (profile === 'teardrop') {
          // buoyant teardrop: shell radius narrows with height
          const tip = y * 0.45
          const rsLocal = rs * (1 - 0.55 * clamp01(y / 0.5 + 0.2))
          d = Math.hypot(wr, y - tip) / (rsLocal / rs + 1e-4)
        }

        const shell = gauss(d - rs, sigma)
        const core = 0.22 * gauss(d, rs * 0.32) // inner glow near burner
        const halo = 0.3 * gauss(d - rs * 1.35, sigma * 1.9) // faint outer haze

        let val = (shell + core + halo) * amp
        // faint turbulence texture, axisymmetric (varies with z,r only)
        val *= 1 + 0.06 * Math.sin(z * 0.25 + r * 0.18 + t * 9.0) * Math.cos(r * 0.4 - t * 6.0)

        frame[z * LUT_R + r] = Math.max(0, val)
      }
    }
    raw.push(frame)
  }

  // one global ceiling for cross-frame comparability
  let globalMax = 0
  for (const fr of raw) {
    for (let i = 0; i < n; i++) if (fr[i] > globalMax) globalMax = fr[i]
  }
  globalMax = globalMax || 1

  const frames: FlameFrame[] = raw.map((fr, f) => {
    const data = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      data[i] = Math.min(255, Math.round((fr[i] / globalMax) * 255))
    }
    return { index: f, tMs: Math.round((f / fps) * 1000), data }
  })

  return { profile, frames, fps, globalMax }
}

/** interpolate between two frames by time fraction (0..1) into a scratch buffer */
export function blendFrames(
  a: FlameFrame | undefined,
  b: FlameFrame | undefined,
  mix: number,
  out: Uint8Array,
): void {
  const n = LUT_Z * LUT_R
  const aa = a?.data
  const bb = b?.data
  if (!aa && !bb) {
    out.fill(0)
    return
  }
  if (!aa) {
    out.set(bb!)
    return
  }
  if (!bb) {
    out.set(aa)
    return
  }
  const m = clamp01(mix)
  for (let i = 0; i < n; i++) {
    out[i] = Math.round(aa[i] + (bb[i] - aa[i]) * m)
  }
}
