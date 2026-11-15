// Numerical observation of the current exported model; no source is modified.
import { writeFile } from 'node:fs/promises'
import { simulatePhysicsFlame } from '../../app/src/features/vr/flamePhysics.ts'

const sequence = simulatePhysicsFlame({ burnSeconds: 50 })
const sums = sequence.frames.map((frame) => frame.data.reduce((a, b) => a + b, 0))
const peaks = []
for (let i = 1; i < sums.length - 1; i++) {
  if (sums[i] > sums[i - 1] && sums[i] >= sums[i + 1]) peaks.push(i / sequence.fps)
}
const result = {
  requestedBurnSeconds: 50,
  frameCount: sequence.frames.length,
  fps: sequence.fps,
  lastTimestampSeconds: sequence.frames.at(-1).tMs / 1000,
  pulsePeakSeconds: peaks,
}
await writeFile(new URL('./physics-measurements.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(result)
