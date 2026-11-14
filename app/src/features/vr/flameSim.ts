/* ————————————————————————————————————————————————————————————
   Equation-based flame simulation (2D axisymmetric slice).

   Instead of a hand-authored shell, this solves the incompressible
   Navier–Stokes equations with Boussinesq buoyancy plus an advected
   combustion front, then hands the temperature field to the raymarcher
   as the emission ε(r,z).

   Per step:
     1. buoyancy   v += k_b · (T − T_amb)              (Boussinesq)
     2. vorticity  force = ε · (N × ω)                 (confinement)
     3. advection  semi-Lagrangian:  ∂q/∂t + u·∇q = 0
     4. pressure   ∇²p = ∇·u  (Jacobi) then u −= ∇p     (incompressibility)
     5. combustion F + O₂ → heat                       (one-step reaction)
     6. cooling    T −= k_c · T                         (radiation)

   The domain is a vertical slice (x = radial, y = axial); the renderer
   treats the right half as r and mirrors it, preserving axisymmetry.
   ———————————————————————————————————————————————————————————— */

export interface FlameSimOptions {
  nx?: number
  nz?: number
  frames?: number
  fps?: number
  /** 0 = microgravity (no buoyancy), 1 = terrestrial */
  gravity?: number
  vorticity?: number
  seed?: number
}

export interface FlameSimFrame {
  index: number
  tMs: number
  /** ε(z,r), length LUT_Z·LUT_R, uint8 */
  data: Uint8Array
}

export interface FlameSimSequence {
  frames: FlameSimFrame[]
  fps: number
  globalMax: number
  kind: 'simulation'
}

class FlameSim {
  readonly nx: number
  readonly nz: number
  readonly n: number
  u: Float32Array
  v: Float32Array
  T: Float32Array
  F: Float32Array
  Ox: Float32Array
  p: Float32Array
  div: Float32Array
  curl: Float32Array
  u0: Float32Array
  v0: Float32Array
  T0: Float32Array
  F0: Float32Array
  Ox0: Float32Array
  private rng: number
  private gravity: number
  private vorticity: number

  constructor(nx = 96, nz = 128, gravity = 0.75, vorticity = 0.9, seed = 1) {
    this.nx = nx
    this.nz = nz
    this.n = nx * nz
    this.u = new Float32Array(this.n)
    this.v = new Float32Array(this.n)
    this.T = new Float32Array(this.n)
    this.F = new Float32Array(this.n)
    this.Ox = new Float32Array(this.n)
    this.p = new Float32Array(this.n)
    this.div = new Float32Array(this.n)
    this.curl = new Float32Array(this.n)
    this.u0 = new Float32Array(this.n)
    this.v0 = new Float32Array(this.n)
    this.T0 = new Float32Array(this.n)
    this.F0 = new Float32Array(this.n)
    this.Ox0 = new Float32Array(this.n)
    this.gravity = gravity
    this.vorticity = vorticity
    this.rng = seed >>> 0
    this.reset()
  }

  private rand(): number {
    let a = (this.rng = (this.rng + 0x6d2b79f5) >>> 0)
    a = Math.imul(a ^ (a >>> 15), a | 1)
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61)
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296
  }

  idx(x: number, y: number): number {
    return x + this.nx * y
  }

  reset() {
    this.u.fill(0)
    this.v.fill(0)
    this.T.fill(0)
    this.F.fill(0)
    this.Ox.fill(0.35)
    this.p.fill(0)
    this.div.fill(0)
    this.curl.fill(0)
  }

  setGravity(g: number) {
    this.gravity = g
  }

  /** bilinear sample with clamping */
  private sample(field: Float32Array, fx: number, fy: number): number {
    const nx = this.nx
    const nz = this.nz
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const cx = (v: number) => (v < 0 ? 0 : v >= nz ? nz - 1 : v)
    const cy = (v: number) => (v < 0 ? 0 : v >= nz ? nz - 1 : v)
    const r0 = cx(y0)
    const r1 = cy(y0 + 1)
    const c0 = Math.max(0, Math.min(nx - 1, x0))
    const c1 = Math.max(0, Math.min(nx - 1, x0 + 1))
    const a = field[c0 + nx * r0]
    const b = field[c1 + nx * r0]
    const c = field[c0 + nx * r1]
    const d = field[c1 + nx * r1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }

  /** semi-Lagrangian advection of `src` into `dst` by the velocity field */
  private advect(dst: Float32Array, src: Float32Array, uF: Float32Array, vF: Float32Array) {
    const nx = this.nx
    const nz = this.nz
    for (let y = 0; y < nz; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * y
        const px = x - uF[i]
        const py = y - vF[i]
        dst[i] = this.sample(src, px, py)
      }
    }
  }

  /** buoyancy: hot gas rises, cold sinks */
  private applyBuoyancy(dt: number) {
    const nx = this.nx
    const nz = this.nz
    const kb = 0.11 * this.gravity
    for (let y = 1; y < nz - 1; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * y
        this.v[i] += kb * (this.T[i] - 0.35) * dt
      }
    }
  }

  /** vorticity confinement: re-inject small-scale swirl so the plume flickers */
  private applyVorticity(dt: number) {
    const nx = this.nx
    const nz = this.nz
    const c = this.curl
    for (let y = 1; y < nz - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = x + nx * y
        c[i] =
          0.5 * (this.v[i + 1] - this.v[i - 1]) - 0.5 * (this.u[i + nx] - this.u[i - nx])
      }
    }
    const s = this.vorticity * 0.02 * dt
    for (let y = 1; y < nz - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = x + nx * y
        const gx = Math.abs(c[i + 1]) - Math.abs(c[i - 1])
        const gy = Math.abs(c[i + nx]) - Math.abs(c[i - nx])
        const len = Math.hypot(gx, gy) + 1e-5
        // N = ∇|ω|/|∇|ω||, force = ε · (N × ω) (2D: perpendicular)
        this.u[i] += s * (gy / len) * c[i]
        this.v[i] -= s * (gx / len) * c[i]
      }
    }
  }

  /** Jacobi pressure projection (incompressible flow) */
  private project(iterations = 18) {
    const nx = this.nx
    const nz = this.nz
    const div = this.div
    const p = this.p
    for (let y = 0; y < nz; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * y
        const xl = x > 0 ? i - 1 : i
        const xr = x < nx - 1 ? i + 1 : i
        const yl = y > 0 ? i - nx : i
        const yr = y < nz - 1 ? i + nx : i
        div[i] = -0.5 * (this.u[xr] - this.u[xl] + this.v[yr] - this.v[yl])
        p[i] = 0
      }
    }
    for (let k = 0; k < iterations; k++) {
      for (let y = 1; y < nz - 1; y++) {
        for (let x = 1; x < nx - 1; x++) {
          const i = x + nx * y
          p[i] = (div[i] + p[i - 1] + p[i + 1] + p[i - nx] + p[i + nx]) * 0.25
        }
      }
    }
    for (let y = 1; y < nz - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = x + nx * y
        this.u[i] -= 0.5 * (p[i + 1] - p[i - 1])
        this.v[i] -= 0.5 * (p[i + nx] - p[i - nx])
      }
    }
  }

  /** boundaries: solid floor, open top/sides */
  private boundaries() {
    const nx = this.nx
    const nz = this.nz
    for (let x = 0; x < nx; x++) {
      const i = x + nx * 0 // bottom
      this.u[i] = 0
      this.v[i] = 0
      this.T[i] = 0
      const t = x + nx * (nz - 1) // top: outflow
      this.u[t] = 0
      this.v[t] = this.v[t - nx]
      this.T[t] = this.T[t - nx] * 0.7
      this.F[t] = this.F[t - nx]
      this.Ox[t] = this.Ox[t - nx]
    }
    for (let y = 0; y < nz; y++) {
      const l = nx * y
      const r = nx - 1 + nx * y
      this.u[l] = 0
      this.u[r] = 0
      this.v[l] = this.v[l + 1]
      this.v[r] = this.v[r - 1]
      this.T[l] = this.T[l + 1]
      this.T[r] = this.T[r - 1]
      this.F[l] = this.F[l + 1]
      this.F[r] = this.F[r - 1]
      this.Ox[l] = this.Ox[l + 1]
      this.Ox[r] = this.Ox[r - 1]
    }
  }

  /** burner: fuel + oxygen + igniter at the bottom centre */
  private burner() {
    const nx = this.nx
    const cx = nx >> 1
    const r = Math.max(2, nx >> 5)
    for (let y = 1; y < 6; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const i = x + nx * y
        this.F[i] = 1.0
        this.Ox[i] = Math.min(1, this.Ox[i] + 0.05)
        this.T[i] = Math.max(this.T[i], 0.9)
        this.v[i] += 0.06
        this.u[i] += (this.rand() - 0.5) * 0.06
      }
    }
  }

  /** one-step combustion: F + O₂ → heat */
  private combust(dt: number) {
    const nx = this.nx
    const k = 9.0 * dt
    for (let y = 1; y < this.nz - 1; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * y
        const f = this.F[i]
        const o = this.Ox[i]
        if (f > 0.01 && o > 0.01 && this.T[i] > 0.15) {
          const rate = Math.min(k * f * o, f, o)
          this.F[i] -= rate
          this.Ox[i] -= rate
          this.T[i] = Math.min(3.2, this.T[i] + rate * 3.2)
        }
      }
    }
  }

  step(dt = 1) {
    // source injection
    this.burner()

    // momentum forces
    this.applyBuoyancy(dt)
    this.applyVorticity(dt)

    // advect velocity
    this.u0.set(this.u)
    this.v0.set(this.v)
    this.advect(this.u, this.u0, this.u0, this.v0)
    this.advect(this.v, this.v0, this.u0, this.v0)

    // viscous damping + CFL clamp
    for (let i = 0; i < this.n; i++) {
      this.u[i] = Math.max(-1, Math.min(1, this.u[i] * 0.995))
      this.v[i] = Math.max(-1, Math.min(1, this.v[i] * 0.995))
    }

    // incompressibility
    this.project(18)

    // advect scalars
    this.T0.set(this.T)
    this.F0.set(this.F)
    this.Ox0.set(this.Ox)
    this.advect(this.T, this.T0, this.u, this.v)
    this.advect(this.F, this.F0, this.u, this.v)
    this.advect(this.Ox, this.Ox0, this.u, this.v)

    // reaction + cooling
    this.combust(dt)
    for (let i = 0; i < this.n; i++) {
      this.T[i] = Math.max(0, this.T[i] * 0.992) // radiation
      if (this.T[i] < 0.002) this.T[i] = 0
    }

    this.boundaries()
  }

  /** temperature field, right half mirrored, normalized to 0..1 */
  emission(out: Float32Array) {
    const nx = this.nx
    const nz = this.nz
    const cx = nx >> 1
    let max = 1e-6
    for (let i = 0; i < this.n; i++) if (this.T[i] > max) max = this.T[i]
    for (let y = 0; y < nz; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * y
        out[i] = this.T[i] / max
      }
    }
    // mirror-left into the right half to enforce axisymmetry
    for (let y = 0; y < nz; y++) {
      for (let d = 1; d < cx; d++) {
        const l = cx - d + nx * y
        const r = cx + d + nx * y
        const m = 0.5 * (out[l] + out[r])
        out[l] = m
        out[r] = m
      }
    }
    return max
  }
}

/**
 * Run the fluid + combustion solver for `frames` steps and return the
 * recorded ε(r,z) sequence (same shape the raymarcher already expects).
 */
export function simulateFlameSequence(opts: FlameSimOptions = {}): FlameSimSequence {
  const nx = opts.nx ?? 96
  const nz = opts.nz ?? 128
  const frames = opts.frames ?? 240
  const fps = opts.fps ?? 24
  const gravity = opts.gravity ?? 0.75
  const vorticity = opts.vorticity ?? 0.9
  const seed = opts.seed ?? 1

  const sim = new FlameSim(nx, nz, gravity, vorticity, seed)
  const LUT_Z = 256
  const LUT_R = 128
  const buf = new Float32Array(sim.n)
  const out: FlameSimFrame[] = []
  const cx = nx >> 1

  let globalMax = 1e-6
  const rawFrames: Float32Array[] = []

  for (let f = 0; f < frames; f++) {
    sim.step(1)
    sim.emission(buf)
    // resample (z, r) from the slice; average left/right about the axis
    const field = new Float32Array(LUT_Z * LUT_R)
    for (let z = 0; z < LUT_Z; z++) {
      const sy = Math.round((1 - z / (LUT_Z - 1)) * (nz - 1))
      for (let r = 0; r < LUT_R; r++) {
        const dx = Math.round((r / (LUT_R - 1)) * (cx - 1))
        const xl = Math.max(0, cx - dx)
        const xr = Math.min(nx - 1, cx + dx)
        const a = buf[xl + nx * sy]
        const b = buf[xr + nx * sy]
        const v = 0.5 * (a + b)
        field[z * LUT_R + r] = v
        if (v > globalMax) globalMax = v
      }
    }
    rawFrames.push(field)
  }

  for (let f = 0; f < rawFrames.length; f++) {
    const src = rawFrames[f]
    const data = new Uint8Array(LUT_Z * LUT_R)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.min(255, Math.round(Math.pow(src[i] / globalMax, 0.5) * 255))
    }
    out.push({ index: f, tMs: Math.round((f / fps) * 1000), data })
  }

  return { frames: out, fps, globalMax, kind: 'simulation' }
}
