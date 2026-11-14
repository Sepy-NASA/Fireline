/* ————————————————————————————————————————————————————————————
   Physics-based microgravity flame.

   Two coupled ingredients:

   1. SPATIAL — diffusion-flame shell. For a spherical burner feeding
      oxygen into a fuel atmosphere the mixture fraction is the steady
      solution of ∇²Z = 0:

          Z(ρ) = (1/ρ − 1/R∞) / (1/Rb − 1/R∞)

      The flame sits where Z = Z_st (Burke–Schumann), i.e. at a shell
      radius ρ_f. Emission is a thin reaction zone around ρ_f plus a hot
      core at the burner.

   2. TEMPORAL — relaxation ("cool-flame") instability. In microgravity
      there is no buoyancy to stabilise the flame; fuel accumulates
      slowly, ignites, burns fast, cools radiatively and re-ignites.
      That limit cycle is what the INTNS light curves show as bursts
      (C1: ~2.2 s apart, B1: late flare, A1: flicker).

          fuel' = +fill                       (accumulation)
          fuel' = −burn                       (deflagration)
          T'    = +q·burn − k·(T − T∞)        (heat release vs loss)

   The resulting ε(ρ,t) is mapped to the axisymmetric LUT as a sphere:
   ε(r,z,t) = I(t) · shell(√(r² + y²)).
   ———————————————————————————————————————————————————————————— */

export interface PhysicsFlameOptions {
  frames?: number
  fps?: number
  /** ambient oxygen mole fraction (CFI-G ~0.39) */
  oxygen?: number
  /** chamber pressure [bar] (CFI-G ~0.94) */
  pressure?: number
  /** measured burn duration [s] (A1 50, B1 43, C1 42) */
  burnSeconds?: number
  /** observed burst interval [s] (C1 ~2.2, A1 ~1.5, B1 ~1.8) */
  burstPeriod?: number
}

export interface PhysicsFlameFrame {
  index: number
  tMs: number
  data: Uint8Array
}

export interface PhysicsFlameSequence {
  frames: PhysicsFlameFrame[]
  fps: number
  globalMax: number
  kind: 'physics'
}

const LUT_Z = 256
const LUT_R = 128

/** relaxation oscillator: returns the normalised heat-release intensity per step */
function makeBurst(t: number, period: number, phase0: number): number {
  // sharp deflagration spike followed by a slow cooling tail
  const phase = ((t / period + phase0) % 1 + 1) % 1
  const spike = Math.exp(-Math.pow((phase - 0.12) / 0.07, 2))
  const tail = 0.35 * Math.exp(-Math.max(0, phase - 0.12) / 0.22)
  const base = 0.18
  return base + spike + tail
}

export function simulatePhysicsFlame(opts: PhysicsFlameOptions = {}): PhysicsFlameSequence {
  const frames = opts.frames ?? 180
  const fps = opts.fps ?? 12
  const oxygen = opts.oxygen ?? 0.39
  const pressure = opts.pressure ?? 0.94
  const burnSeconds = opts.burnSeconds ?? 50
  const burstPeriod = opts.burstPeriod ?? 2.2

  // ---- spatial: Burke–Schumann flame sheet ------------------------------
  const Rb = 0.02
  // stoichiometric mixture fraction chosen so the shell sits at rho_f ~ 0.3
  const rhoF = 0.30
  // flame sheet: Z(rhoF) = Zst, i.e. where O2 and fuel meet stoichiometrically
  const shellWidth = 0.018 + 0.012 * (0.94 / pressure)
  const coreWidth = 0.04
  const coreWeight = 0.07 * (oxygen / 0.39)

  const shellAt = (rho: number): number => {
    const d = rho - rhoF
    const shell = Math.exp(-(d * d) / (2 * shellWidth * shellWidth))
    const core = coreWeight * Math.exp(-((rho - Rb) * (rho - Rb)) / (2 * coreWidth * coreWidth))
    return shell + core
  }

  // ---- temporal: relaxation instability --------------------------------
  // number of bursts across the recording, from the measured period
  const totalSeconds = frames / fps
  const bursts = Math.max(1, Math.round(totalSeconds / burstPeriod))
  const globalPeriod = totalSeconds / bursts
  const phase0 = 0.0

  const rawFrames: Float32Array[] = []
  let globalMax = 1e-6
  const sphere = new Float32Array(LUT_Z * LUT_R)

  for (let f = 0; f < frames; f++) {
    const t = f / fps
    // overall envelope: ignition ramp, steady burn, extinction tail
    const u = frames === 1 ? 0.5 : f / (frames - 1)
    const burnEnd = 1 - Math.min(0.2, 4 / Math.max(1, burnSeconds))
    const envelope = u < 0.04 ? u / 0.04 : u > burnEnd ? Math.max(0, (1 - u) / Math.max(1e-6, 1 - burnEnd)) : 1
    const intensity = makeBurst(t, globalPeriod, phase0) * envelope

    let mx = 0
    for (let z = 0; z < LUT_Z; z++) {
      const y = 0.5 - z / (LUT_Z - 1)
      for (let c = 0; c < LUT_R; c++) {
        const wr = (c / (LUT_R - 1)) * 0.5
        const rho = Math.hypot(wr, y)
        const val = shellAt(rho) * intensity
        sphere[z * LUT_R + c] = val
        if (val > mx) mx = val
      }
    }
    rawFrames.push(Float32Array.from(sphere))
    if (mx > globalMax) globalMax = mx
  }

  const lutFrames: PhysicsFlameFrame[] = []
  for (let f = 0; f < rawFrames.length; f++) {
    const src = rawFrames[f]
    const data = new Uint8Array(LUT_Z * LUT_R)
    for (let i = 0; i < data.length; i++) data[i] = Math.min(255, Math.round((src[i] / globalMax) * 255))
    lutFrames.push({ index: f, tMs: Math.round((f / fps) * 1000), data })
  }

  return { frames: lutFrames, fps, globalMax, kind: 'physics' }
}
