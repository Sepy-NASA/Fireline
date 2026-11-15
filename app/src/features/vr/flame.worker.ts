import { simulatePhysicsFlame, type PhysicsFlameOptions } from './flamePhysics'
self.onmessage = (event: MessageEvent<PhysicsFlameOptions>) => {
  try {
    const sequence = simulatePhysicsFlame(event.data, (progress) => self.postMessage({ progress }))
    self.postMessage({ sequence }, { transfer: sequence.frames.map((frame) => frame.data.buffer) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
