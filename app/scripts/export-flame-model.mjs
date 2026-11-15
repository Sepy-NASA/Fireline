/** Export the same worker solver for reproducible offline comparisons. */
import { readFile, writeFile } from 'node:fs/promises'
import { simulatePhysicsFlame } from '../src/features/vr/flamePhysics.ts'
const id = process.argv[2] ?? '21088A1'
const output = process.argv[3] ?? `/private/tmp/flame-model-${id}`
const base = new URL(`../public/psi159/${id}/`, import.meta.url)
const meta = JSON.parse(await readFile(new URL('lut-index.json', base), 'utf8'))
const catalog = JSON.parse(await readFile(new URL('../tests.json', base), 'utf8')).tests
const params = catalog.find((test) => test.id === id)?.params
if (!params) throw new Error('Unknown experiment')
const calibration = JSON.parse(await readFile(new URL('../model-calibration.json', base), 'utf8'))
const sequence = simulatePhysicsFlame({ oxygen: params.o2, pressure: params.p, massFlowMgS: params.massFlowMgS,
  configuration: params.configuration, fuelMoleFraction: params.fuelMoleFraction,
  ignitionMs: meta.ignitionMs, flowOnMs: meta.flowOnMs, flowOffMs: meta.flowOffMs,
  frameTimesMs: meta.timesMs, durationMs: meta.durationMs, geometry: meta.geometry, ...calibration.parameters })
await writeFile(output + '.bin', Buffer.concat(sequence.frames.map((frame) => Buffer.from(frame.data.buffer))))
await writeFile(output + '.json', JSON.stringify({ testpoint: id, timesMs: sequence.frames.map((frame) => frame.tMs), diagnostics: sequence.diagnostics }, null, 2) + '\n')
console.log('Exported', sequence.frames.length, 'frames to', output)
