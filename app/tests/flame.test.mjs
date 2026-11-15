import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { bracketTime, nearestTimeIndex, validateTimes } from '../src/features/vr/flameTime.ts'
import { decodeLut, fromHalf, toHalf, LUT_Z, LUT_R } from '../src/features/vr/flameField.ts'
import { ETHANE_LHV_J_KG, SphericalFlameSolver, simulatePhysicsFlame } from '../src/features/vr/flamePhysics.ts'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { eyeOriginInVolume } from '../src/features/vr/flameCamera.ts'

test('stereo eye separation survives moving and scaling the volume', () => {
  const volume = new Matrix4().compose(new Vector3(1, 1.5, -2), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3), new Vector3(0.62, 0.62, 0.62))
  const left = eyeOriginInVolume(new Matrix4().makeTranslation(-0.032, 1.6, 0), volume, new Vector3(), new Matrix4())
  const right = eyeOriginInVolume(new Matrix4().makeTranslation(0.032, 1.6, 0), volume, new Vector3(), new Matrix4())
  assert.ok(Math.abs(left.distanceTo(right) - 0.064 / 0.62) < 1e-12)
  assert.ok(left.distanceTo(right) > 0)
})

test('nonuniform acquisition clock brackets by elapsed milliseconds', () => {
  assert.deepEqual(bracketTime([0, 43, 120, 1000], 500), { a: 2, b: 3, mix: 380 / 880 })
  assert.equal(nearestTimeIndex([0, 43, 120, 1000], 900), 3)
  assert.deepEqual(bracketTime([0, 43, 120], 500), { a: 2, b: 2, mix: 0 })
  assert.throws(() => validateTimes([0, 43, 43], 3))
  assert.throws(() => validateTimes([0, Number.NaN], 2))
})
test('half precision retains faint signals over a shared linear range', () => {
  for (const value of [0, 1e-6, 0.0001, 0.01, 1, 3.5, 256, 65000]) {
    assert.ok(Math.abs(fromHalf(toHalf(value)) - value) <= Math.max(value * 0.001, 3e-8), String(value))
  }
})
for (const id of ['21088A1', '21088B1', '21088C1']) test(`${id}: complete full-rate field, real timestamps and shared sensor origin`, async () => {
  const base = new URL(`../public/psi159/${id}/`, import.meta.url)
  const meta = JSON.parse(await readFile(new URL('lut-index.json', base), 'utf8'))
  const packed = await readFile(new URL(meta.file, base))
  const data = gunzipSync(packed)
  const sequence = decodeLut(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), meta)
  assert.ok(sequence.frames.length >= 1800)
  assert.equal(sequence.frames.at(-1).tMs, meta.durationMs)
  assert.ok(meta.fps > 23 && meta.fps < 24)
  assert.equal(meta.radiometry.perFrameNormalization, false)
  assert.ok(meta.validation.medianProjectionNrmse < 0.1)
  const sensors = JSON.parse(await readFile(new URL('sensors.json', base), 'utf8'))
  assert.equal(sensors.timeOrigin, meta.timeOrigin)
  assert.ok(sensors.t[0] < 0)
  assert.ok(meta.flowOffMs > meta.extinctionMs)
  assert.ok(meta.ignitionMs - meta.flowOnMs >= 0 && meta.ignitionMs - meta.flowOnMs < 5000, 'short raw MFC spikes must not move the fuel clock')
  const faint = sequence.frames[Math.round(sequence.frames.length * 0.6)].data
  assert.ok(new Set(faint).size > 255, 'faint emission must retain more than byte precision')
  const incomplete = new ArrayBuffer(2)
  assert.throws(() => decodeLut(incomplete, meta))
})
test('zero source leaves cold microgravity equilibrium unchanged', () => {
  const solver = new SphericalFlameSolver({ massFlowMgS: 0, ignitionMs: 1e9, flowOnMs: 0, flowOffMs: 10000 })
  solver.advanceTo(2)
  assert.ok(solver.temperature.every((t) => Math.abs(t - 300) < 1e-8))
  assert.ok(solver.fuel.every((f) => f === 0))
  assert.equal(solver.diagnostics.releasedEnergyJ, 0)
})
test('finite-volume reaction respects mass fractions and the injected fuel energy budget', () => {
  const solver = new SphericalFlameSolver()
  solver.advanceTo(10)
  assert.ok(solver.diagnostics.releasedEnergyJ > 10)
  assert.ok(solver.diagnostics.releasedEnergyJ <= solver.diagnostics.injectedFuelKg * ETHANE_LHV_J_KG * 1.01)
  assert.ok(solver.diagnostics.minMassFraction > -1e-12)
  assert.ok(solver.diagnostics.maxSpeciesSumError < 1e-9)
  assert.ok(solver.temperature.every((t) => Number.isFinite(t) && t >= 300))
})
test('time-step refinement converges heat release and radius', () => {
  const coarse = new SphericalFlameSolver()
  const fine = new SphericalFlameSolver()
  coarse.advanceTo(8, 0.005)
  fine.advanceTo(8, 0.0025)
  const a = coarse.sample(8000), b = fine.sample(8000)
  assert.ok(Math.abs(a.heatReleaseW - b.heatReleaseW) / b.heatReleaseW < 0.05)
  assert.ok(Math.abs(a.radiusMeters - b.radiusMeters) / b.radiusMeters < 0.08)
})
test('radial grid refinement preserves heat release and shell radius', () => {
  const coarse = new SphericalFlameSolver({ cells: 96 })
  const fine = new SphericalFlameSolver({ cells: 192 })
  coarse.advanceTo(8); fine.advanceTo(8)
  const a = coarse.sample(8000), b = fine.sample(8000)
  assert.ok(Math.abs(a.heatReleaseW - b.heatReleaseW) / b.heatReleaseW < 0.02)
  assert.ok(Math.abs(a.radiusMeters - b.radiusMeters) / b.radiusMeters < 0.03)
  assert.ok(Math.abs(a.burnerTemperatureK - b.burnerTemperatureK) / b.burnerTemperatureK < 0.1)
})
test('a fuel stream without oxygen cannot create reaction emission', () => {
  const solver = new SphericalFlameSolver({ oxygen: 0 })
  solver.advanceTo(3)
  assert.equal(solver.diagnostics.releasedEnergyJ, 0)
  assert.equal(solver.sample(3000).heatReleaseW, 0)
  assert.throws(() => new SphericalFlameSolver({ pressure: Number.NaN }))
})
test('model duration and nonuniform sample times are preserved without a burst clock', () => {
  const sequence = simulatePhysicsFlame({ frameTimesMs: [0, 500, 1500, 3100, 5100], flowOffMs: 4000 })
  assert.deepEqual(sequence.frames.map((frame) => frame.tMs), [0, 500, 1500, 3100, 5100])
  assert.equal(sequence.frames[0].data.length, LUT_Z * LUT_R)
  assert.equal(sequence.diagnostics.referenceExtinctionImposed, false)
  assert.ok(sequence.frames[0].data.every((value) => value === 0))
})
