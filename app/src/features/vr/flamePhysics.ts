import { DEFAULT_GEOMETRY, LUT_R, LUT_Z, toHalf, type FlameGeometry, type FlameSequence } from './flameField.ts'
import { validateTimes } from './flameTime.ts'

/** Reduced hot-ethane model in SI units. No prescribed oscillation and no
 * claim to model low-temperature chemistry. Implicit spherical finite volumes
 * transport species and enthalpy; continuity includes thermal expansion. */
export interface PhysicsFlameOptions {
  oxygen?: number; pressure?: number; massFlowMgS?: number; fuelMoleFraction?: number
  configuration?: 'normal' | 'inverse'; burnSeconds?: number; ignitionMs?: number
  flowOnMs?: number; flowOffMs?: number; durationMs?: number; frameTimesMs?: number[]
  fps?: number; cells?: number; dt?: number; geometry?: FlameGeometry
  radiationCoefficient?: number; transportMultiplier?: number
  outerRadiusMeters?: number
  emissionScale?: number
}
export interface PhysicsDiagnostics {
  model: string; chemistry: string; maxSpeciesSumError: number; minMassFraction: number
  maxTemperatureK: number; releasedEnergyJ: number; radiatedEnergyJ: number
  injectedFuelKg: number; integrationSteps: number; referenceExtinctionImposed: false
  samples: { tMs: number; radiusMeters: number; peakTemperatureK: number; heatReleaseW: number; burnerTemperatureK: number }[]
}
export interface PhysicsFlameSequence extends FlameSequence { kind: 'physics'; diagnostics: PhysicsDiagnostics }
const PI4 = 4 * Math.PI
const GAS_R = 8.314462618
const SIGMA = 5.670374419e-8
const OXYGEN_PER_FUEL = 112 / 30.07
export const ETHANE_LHV_J_KG = 47.5e6
const AMBIENT = 300
const cp = (t: number) => 1250 + 0.6 * Math.max(0, t - AMBIENT)
const enthalpy = (t: number) => 1250 * (t - AMBIENT) + 0.3 * (t - AMBIENT) ** 2
const temperatureFromH = (h: number) => AMBIENT + (2 * Math.max(0, h)) / (1250 + Math.sqrt(1250 ** 2 + 1.2 * Math.max(0, h)))

export class SphericalFlameSolver {
  readonly n: number
  readonly radius: Float64Array
  readonly fuel: Float64Array
  readonly oxygen: Float64Array
  readonly products: Float64Array
  readonly h: Float64Array
  readonly temperature: Float64Array
  readonly density: Float64Array
  readonly heatRelease: Float64Array
  private edges: Float64Array
  private area: Float64Array
  private volume: Float64Array
  private massFlux: Float64Array
  private previousDensity: Float64Array
  private lower: Float64Array
  private diagonal: Float64Array
  private upper: Float64Array
  private rhs: Float64Array
  private diffusivity: Float64Array
  private time = 0
  private burnerT = AMBIENT
  private pressure: number
  private massFlow: number
  private fuelFraction: number
  private normal: boolean
  private radiation: number
  private transportMultiplier: number
  private emissionScale: number
  private oxygenAmbient: number
  private ignition: number
  private flowOn: number
  private flowOff: number
  readonly diagnostics: PhysicsDiagnostics = {
    model: '1D spherical finite-volume hot-flame model (reduced, not quantitatively validated)',
    chemistry: 'Global ethane oxidation; cool-flame chemistry is outside this model',
    maxSpeciesSumError: 0, minMassFraction: 0, maxTemperatureK: AMBIENT,
    releasedEnergyJ: 0, radiatedEnergyJ: 0, injectedFuelKg: 0, integrationSteps: 0,
    referenceExtinctionImposed: false, samples: [],
  }
  constructor(opts: PhysicsFlameOptions = {}) {
    const o2 = opts.oxygen ?? 0.3939
    this.pressure = opts.pressure ?? 0.9444
    this.massFlow = opts.massFlowMgS ?? 2
    this.fuelFraction = opts.fuelMoleFraction ?? 1
    this.normal = (opts.configuration ?? 'normal') === 'normal'
    this.radiation = opts.radiationCoefficient ?? 0.45
    this.transportMultiplier = opts.transportMultiplier ?? 1
    this.emissionScale = opts.emissionScale ?? 1
    const inputs = [o2, this.pressure, this.massFlow, this.fuelFraction, this.radiation, this.transportMultiplier, this.emissionScale]
    if (!inputs.every(Number.isFinite) || !(o2 >= 0 && o2 <= 1 && this.pressure > 0 && this.massFlow >= 0 && this.fuelFraction >= 0 && this.fuelFraction <= 1 && this.radiation >= 0 && this.transportMultiplier > 0 && this.emissionScale >= 0)) throw new Error('Invalid gas composition, pressure, transport or emission coefficient')
    this.n = opts.cells ?? 96
    if (!Number.isInteger(this.n) || this.n < 16 || this.n > 512) throw new Error('Invalid radial cell count')
    this.ignition = (opts.ignitionMs ?? 1000) / 1000
    this.flowOn = (opts.flowOnMs ?? opts.ignitionMs ?? 1000) / 1000
    this.flowOff = (opts.flowOffMs ?? ((opts.ignitionMs ?? 1000) + (opts.burnSeconds ?? 50) * 1000)) / 1000
    if (![this.ignition, this.flowOn, this.flowOff].every(Number.isFinite) || this.ignition < 0 || this.flowOn < 0 || this.flowOff <= this.flowOn) throw new Error('Invalid ignition/flow timing')
    this.oxygenAmbient = o2 * 32 / (o2 * 32 + (1 - o2) * 28.014)
    const geometry = opts.geometry ?? DEFAULT_GEOMETRY
    const rb = geometry.burnerRadiusMeters
    // The camera crop is not a physical reservoir boundary. Keep the ambient
    // far away on a graded mesh so a hot nearby Dirichlet edge cannot force
    // a premature steady flame or continuously replenish depleted oxygen.
    const outer = opts.outerRadiusMeters ?? Math.max(0.15, geometry.domainMeters * 2)
    if (![outer, rb, geometry.domainMeters].every(Number.isFinite) || !(outer > rb && rb > 0 && geometry.domainMeters > rb * 2)) throw new Error('Invalid burner/domain geometry')
    this.edges = Float64Array.from({ length: this.n + 1 }, (_, i) => rb * (outer / rb) ** (i / this.n))
    this.radius = Float64Array.from({ length: this.n }, (_, i) => (this.edges[i] + this.edges[i + 1]) / 2)
    this.area = Float64Array.from(this.edges, (r) => PI4 * r * r)
    this.volume = Float64Array.from({ length: this.n }, (_, i) => PI4 / 3 * (this.edges[i + 1] ** 3 - this.edges[i] ** 3))
    const fuelMassFraction = this.fuelFraction * 30.07 / (this.fuelFraction * 30.07 + (1 - this.fuelFraction) * 28.014)
    this.fuel = new Float64Array(this.n).fill(this.normal ? 0 : fuelMassFraction)
    this.oxygen = new Float64Array(this.n).fill(this.normal ? this.oxygenAmbient : 0)
    this.products = new Float64Array(this.n)
    this.h = new Float64Array(this.n)
    this.temperature = new Float64Array(this.n).fill(AMBIENT)
    this.density = new Float64Array(this.n)
    this.previousDensity = new Float64Array(this.n)
    this.heatRelease = new Float64Array(this.n)
    this.massFlux = new Float64Array(this.n + 1)
    this.lower = new Float64Array(this.n)
    this.diagonal = new Float64Array(this.n)
    this.upper = new Float64Array(this.n)
    this.rhs = new Float64Array(this.n)
    this.diffusivity = new Float64Array(this.n)
    this.updateThermodynamics()
  }
  private updateThermodynamics() {
    for (let i = 0; i < this.n; i++) {
      const t = this.temperature[i] = temperatureFromH(this.h[i])
      const inert = Math.max(0, 1 - this.fuel[i] - this.oxygen[i] - this.products[i])
      const invMw = this.fuel[i] / 0.03007 + this.oxygen[i] / 0.032 + this.products[i] / 0.027 + inert / 0.028014
      this.density[i] = this.pressure * 1e5 / (GAS_R * t * invMw)
    }
  }
  /** Implicit upwind + diffusion, using spherical face areas and cell masses. */
  private transport(field: Float64Array, inner: number, outer: number, dt: number, thermal = false) {
    for (let i = 0; i < this.n; i++) {
      const t = this.temperature[i]
      this.diffusivity[i] = thermal
        ? 0.026 * (t / AMBIENT) ** 0.75 / (this.density[i] * cp(t))
        : 1.8e-5 * (t / AMBIENT) ** 1.7 / this.pressure * this.transportMultiplier
    }
    for (let i = 0; i < this.n; i++) {
      const mass = this.density[i] * this.volume[i]
      const dl = i ? this.radius[i] - this.radius[i - 1] : this.radius[i] - this.edges[0]
      const dr = i < this.n - 1 ? this.radius[i + 1] - this.radius[i] : this.edges[this.n] - this.radius[i]
      // Danckwerts species inlet: prescribed total injection, no additional
      // unaccounted diffusive fuel source through a Dirichlet boundary.
      const kl = i ? (this.density[i] * this.diffusivity[i] + this.density[i - 1] * this.diffusivity[i - 1]) / 2 : thermal ? this.density[i] * this.diffusivity[i] : 0
      const kr = i < this.n - 1 ? (this.density[i] * this.diffusivity[i] + this.density[i + 1] * this.diffusivity[i + 1]) / 2 : this.density[i] * this.diffusivity[i]
      const leftDiffusion = this.area[i] * kl / dl
      const rightDiffusion = this.area[i + 1] * kr / dr
      const left = dt * (leftDiffusion + Math.max(0, this.massFlux[i])) / mass
      const right = dt * (rightDiffusion + Math.max(0, -this.massFlux[i + 1])) / mass
      this.lower[i] = -left
      this.upper[i] = -right
      this.diagonal[i] = 1 + dt * (leftDiffusion + rightDiffusion + Math.max(0, this.massFlux[i + 1]) + Math.max(0, -this.massFlux[i])) / mass
      this.rhs[i] = field[i] * this.previousDensity[i] / this.density[i]
    }
    this.rhs[0] -= this.lower[0] * inner
    this.rhs[this.n - 1] -= this.upper[this.n - 1] * outer
    this.lower[0] = this.upper[this.n - 1] = 0
    for (let i = 1; i < this.n; i++) {
      const f = this.lower[i] / this.diagonal[i - 1]
      this.diagonal[i] -= f * this.upper[i - 1]
      this.rhs[i] -= f * this.rhs[i - 1]
    }
    field[this.n - 1] = this.rhs[this.n - 1] / this.diagonal[this.n - 1]
    for (let i = this.n - 2; i >= 0; i--) field[i] = (this.rhs[i] - this.upper[i] * field[i + 1]) / this.diagonal[i]
  }
  step(dt: number) {
    if (!(dt > 0 && dt <= 0.05)) throw new Error('Integration dt must be in (0, 0.05] s')
    const midTime = this.time + dt / 2
    const flowing = midTime >= this.flowOn && midTime < this.flowOff
    const massFlow = flowing ? this.massFlow * 1e-6 : 0
    this.previousDensity.set(this.density)
    // First-order low-Mach density projection. Conservatively transport into
    // the EOS density predicted from the previous thermal state, rather than
    // overwriting cell masses after reaction (which would create fuel).
    this.updateThermodynamics()
    this.massFlux[0] = massFlow
    for (let i = 0; i < this.n; i++) this.massFlux[i + 1] = this.massFlux[i] - (this.density[i] - this.previousDensity[i]) * this.volume[i] / dt
    const inletFuel = this.normal ? this.fuelFraction * 30.07 / (this.fuelFraction * 30.07 + (1 - this.fuelFraction) * 28.014) : 0
    const ambientFuel = this.fuelFraction * 30.07 / (this.fuelFraction * 30.07 + (1 - this.fuelFraction) * 28.014)
    this.transport(this.fuel, flowing ? inletFuel : this.fuel[0], this.normal ? 0 : ambientFuel, dt)
    this.transport(this.oxygen, flowing ? (this.normal ? 0 : this.oxygenAmbient) : this.oxygen[0], this.normal ? this.oxygenAmbient : 0, dt)
    this.transport(this.products, 0, 0, dt)
    this.transport(this.h, enthalpy(this.burnerT), 0, dt, true)
    this.heatRelease.fill(0)
    for (let i = 0; i < this.n; i++) {
      if (midTime >= this.ignition && midTime < this.ignition + 0.5 && this.radius[i] < this.edges[0] + 0.004) {
        this.h[i] += Math.max(0, enthalpy(1800) - this.h[i]) * -Math.expm1(-dt / 0.03)
      }
      let t = temperatureFromH(this.h[i])
      const limit = Math.min(this.fuel[i], this.oxygen[i] / OXYGEN_PER_FUEL)
      const rate = 5e6 * Math.exp(-10000 / t) * this.density[i] * Math.max(this.oxygen[i], OXYGEN_PER_FUEL * this.fuel[i])
      const extent = Math.max(0, limit * -Math.expm1(-rate * dt))
      this.fuel[i] -= extent
      this.oxygen[i] -= extent * OXYGEN_PER_FUEL
      this.products[i] += extent * (1 + OXYGEN_PER_FUEL)
      this.h[i] += extent * ETHANE_LHV_J_KG
      this.heatRelease[i] = extent * ETHANE_LHV_J_KG * this.density[i] * this.volume[i] / dt
      this.diagnostics.releasedEnergyJ += this.heatRelease[i] * dt
      t = temperatureFromH(this.h[i])
      const kappa = this.radiation * this.pressure * this.products[i]
      const loss = 4 * SIGMA * kappa * (t ** 4 - AMBIENT ** 4) / this.density[i]
      const before = this.h[i]
      this.h[i] = before / (1 + dt * Math.max(0, loss) / Math.max(before, 1))
      this.diagnostics.radiatedEnergyJ += (before - this.h[i]) * this.density[i] * this.volume[i]
      const sum = this.fuel[i] + this.oxygen[i] + this.products[i]
      this.diagnostics.maxSpeciesSumError = Math.max(this.diagnostics.maxSpeciesSumError, Math.max(0, sum - 1))
      this.diagnostics.minMassFraction = Math.min(this.diagnostics.minMassFraction, this.fuel[i], this.oxygen[i], this.products[i])
    }
    for (let i = 0; i < this.n; i++) {
      this.temperature[i] = temperatureFromH(this.h[i])
      this.diagnostics.maxTemperatureK = Math.max(this.diagnostics.maxTemperatureK, this.temperature[i])
    }
    const rb = this.edges[0]
    const qGas = this.area[0] * 0.026 * (this.temperature[0] / AMBIENT) ** 0.75 * (this.temperature[0] - this.burnerT) / (this.radius[0] - rb)
    const qWall = this.area[0] * 0.35 * SIGMA * (this.burnerT ** 4 - AMBIENT ** 4)
    const capacity = PI4 / 3 * rb ** 3 * 7900 * 500
    this.burnerT = Math.max(AMBIENT, this.burnerT + dt * (qGas - qWall) / capacity)
    this.diagnostics.injectedFuelKg += this.normal ? massFlow * inletFuel * dt : 0
    this.time += dt
    this.diagnostics.integrationSteps++
  }
  advanceTo(seconds: number, dt = 0.005) {
    while (this.time < seconds - 1e-9) this.step(Math.min(dt, seconds - this.time))
  }
  sample(tMs: number) {
    let peak = 0
    for (let i = 1; i < this.n; i++) if (this.heatRelease[i] > this.heatRelease[peak]) peak = i
    const heat = this.heatRelease.reduce((a, b) => a + b, 0)
    const sample = { tMs, radiusMeters: heat > 1e-5 ? this.radius[peak] : 0, peakTemperatureK: Math.max(...this.temperature), heatReleaseW: heat, burnerTemperatureK: this.burnerT }
    this.diagnostics.samples.push(sample)
    return sample
  }
  emission(localRadius: number, geometry: FlameGeometry): number {
    const r = localRadius * geometry.domainMeters
    if (r < this.edges[0] || r >= this.edges[this.n]) return 0
    let lo = 0
    let hi = this.n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1
      if (this.radius[mid] <= r) lo = mid
      else hi = mid
    }
    const i = lo
    const m = Math.max(0, Math.min(1, (r - this.radius[i]) / (this.radius[i + 1] - this.radius[i])))
    // Heat-release density proxy; not radiometrically calibrated RGB.
    return this.emissionScale * ((1 - m) * this.heatRelease[i] / this.volume[i] + m * this.heatRelease[i + 1] / this.volume[i + 1]) / 3e7
  }
}
export function simulatePhysicsFlame(opts: PhysicsFlameOptions = {}, onProgress?: (fraction: number) => void): PhysicsFlameSequence {
  const ignitionMs = opts.ignitionMs ?? 1000
  const duration = opts.durationMs ?? (ignitionMs + (opts.burnSeconds ?? 50) * 1000 + 5000)
  const fps = opts.fps ?? 12
  const times = opts.frameTimesMs ?? Array.from({ length: Math.ceil(duration / 1000 * fps) + 1 }, (_, i) => Math.min(duration, i / fps * 1000))
  validateTimes(times, times.length)
  const geometry = opts.geometry ?? DEFAULT_GEOMETRY
  const solver = new SphericalFlameSolver(opts)
  const lookup = new Float64Array(LUT_Z * LUT_R)
  for (let z = 0; z < LUT_Z; z++) for (let r = 0; r < LUT_R; r++) lookup[z * LUT_R + r] = Math.hypot(0.5 - (z + 0.5) / LUT_Z, (r + 0.5) / LUT_R * 0.5)
  const frames = times.map((tMs, index) => {
    solver.advanceTo(tMs / 1000, opts.dt ?? 0.005)
    solver.sample(tMs)
    const data = Uint16Array.from(lookup, (r) => toHalf(solver.emission(r, geometry)))
    if (index % 24 === 0) onProgress?.(index / times.length)
    return { index, tMs, data }
  })
  onProgress?.(1)
  const actualFps = times.length > 1 ? (times.length - 1) * 1000 / (times.at(-1)! - times[0]) : 0
  return { frames, fps: actualFps, geometry, kind: 'physics', diagnostics: solver.diagnostics }
}
