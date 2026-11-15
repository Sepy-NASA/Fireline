/** Fit two reduced-model coefficients to A1 only; report B1/C1 as holdouts.
 * Geometry remains an explicitly provisional camera calibration. */
import { readFile, writeFile } from 'node:fs/promises'
import { ETHANE_LHV_J_KG, SphericalFlameSolver } from '../src/features/vr/flamePhysics.ts'
const root = new URL('../public/psi159/', import.meta.url)
const catalog = JSON.parse(await readFile(new URL('tests.json', root), 'utf8')).tests
async function experiment(id) {
  const meta = JSON.parse(await readFile(new URL(`${id}/lut-index.json`, root), 'utf8'))
  const metrics = JSON.parse(await readFile(new URL(`${id}/metrics.json`, root), 'utf8')).frames
  const p = catalog.find((test) => test.id === id).params
  const all = metrics.filter((f) => f.tMs > meta.ignitionMs + 8000 && f.tMs < meta.extinctionMs - 5000 && f.saturatedFraction < 0.01 && f.meanSignal > 0.002 && !f.inferredFromPrior)
  const step = Math.max(1, Math.floor(all.length / 24))
  const selected = all.filter((_, i) => i % step === 0)
  if (selected.length < 5) throw new Error(`Not enough usable reconstruction samples for ${id}`)
  return { meta, p, selected }
}
function evaluate(exp, radiationCoefficient, transportMultiplier) {
  const { meta, p, selected } = exp
  const solver = new SphericalFlameSolver({ oxygen: p.o2, pressure: p.p, massFlowMgS: p.massFlowMgS,
    ignitionMs: meta.ignitionMs, flowOnMs: meta.flowOnMs, flowOffMs: meta.flowOffMs, geometry: meta.geometry,
    radiationCoefficient, transportMultiplier })
  const samples = []
  let radiusErrorSquared = 0
  let emissionCross = 0, emissionSquared = 0
  for (const reference of selected) {
    solver.advanceTo(reference.tMs / 1000)
    const sample = solver.sample(reference.tMs)
    const measuredRadius = reference.radiusPixels * meta.geometry.pixelSizeMeters
    radiusErrorSquared += (sample.radiusMeters - measuredRadius) ** 2
    let emissionIntegral = 0
    for (let z = 0; z < 128; z++) for (let r = 0; r < 64; r++) {
      const radial = (r + 0.5) / 64 * 0.5
      emissionIntegral += solver.emission(Math.hypot(0.5 - (z + 0.5) / 128, radial), meta.geometry) * radial
    }
    emissionCross += emissionIntegral * reference.emissionIntegral
    emissionSquared += emissionIntegral ** 2
    samples.push({ tMs: reference.tMs, referenceRadiusMeters: measuredRadius, modelRadiusMeters: sample.radiusMeters, referenceEmissionIntegral: reference.emissionIntegral, modelEmissionIntegral: emissionIntegral })
  }
  solver.advanceTo(meta.durationMs / 1000)
  const last = solver.sample(meta.durationMs)
  const wallTarget = p.tBurnerC + 273.15
  const radiusRmse = Math.sqrt(radiusErrorSquared / selected.length)
  const referenceMean = samples.reduce((sum, f) => sum + f.referenceRadiusMeters, 0) / samples.length
  return { radiusRmseMeters: radiusRmse, relativeRadiusRmse: radiusRmse / referenceMean,
    finalBurnerTemperatureK: last.burnerTemperatureK, referencePeakBurnerTemperatureK: wallTarget,
    wallTemperatureDifferenceK: last.burnerTemperatureK - wallTarget,
    releasedEnergyJ: solver.diagnostics.releasedEnergyJ,
    injectedFuelEnergyJ: solver.diagnostics.injectedFuelKg * ETHANE_LHV_J_KG,
    fittedEmissionScale: emissionCross / Math.max(emissionSquared, 1e-12), samples,
    score: (radiusRmse / (0.25 * referenceMean)) ** 2 + 0.3 * ((last.burnerTemperatureK - wallTarget) / 100) ** 2 }
}
const training = await experiment('21088A1')
let best
const candidates = []
for (const radiationCoefficient of [0.3, 0.45, 0.6, 0.9]) for (const transportMultiplier of [0.8, 1, 1.2]) {
  const result = evaluate(training, radiationCoefficient, transportMultiplier)
  const candidate = { radiationCoefficient, transportMultiplier, score: result.score }
  candidates.push(candidate)
  if (!best || candidate.score < best.score) best = candidate
  console.log('A1 fit', candidate)
}
const result = {
  schemaVersion: 1, trainingTest: '21088A1', parameters: { radiationCoefficient: best.radiationCoefficient, transportMultiplier: best.transportMultiplier },
  scope: 'Reduced hot-ethane model. Radius fitting uses an estimated camera scale. Burner target is a reported peak, not a synchronized final measurement. No cool-flame mechanism; extinction is not imposed.',
  candidates, validation: {},
}
for (const test of catalog) result.validation[test.id] = evaluate(await experiment(test.id), best.radiationCoefficient, best.transportMultiplier)
result.parameters.emissionScale = result.validation['21088A1'].fittedEmissionScale
for (const value of Object.values(result.validation)) {
  let residual = 0, referenceEnergy = 0
  for (const sample of value.samples) {
    residual += (sample.modelEmissionIntegral * result.parameters.emissionScale - sample.referenceEmissionIntegral) ** 2
    referenceEnergy += sample.referenceEmissionIntegral ** 2
  }
  value.emissionProxyNrmse = Math.sqrt(residual / referenceEnergy)
}
await writeFile(new URL('model-calibration.json', root), JSON.stringify(result, null, 2) + '\n')
console.log('Selected', result.parameters)
for (const [id, value] of Object.entries(result.validation)) console.log(id, 'radius RMSE mm', value.radiusRmseMeters * 1000, 'wall difference K', value.wallTemperatureDifferenceK)
