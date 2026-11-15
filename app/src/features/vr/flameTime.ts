/** Bracket nonuniform acquisition times without inventing an FPS clock. */
export function bracketTime(times: readonly number[], tMs: number): { a: number; b: number; mix: number } {
  if (!times.length || tMs <= times[0]) return { a: 0, b: 0, mix: 0 }
  const last = times.length - 1
  if (tMs >= times[last]) return { a: last, b: last, mix: 0 }
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (times[mid] <= tMs) lo = mid
    else hi = mid
  }
  return { a: lo, b: hi, mix: (tMs - times[lo]) / (times[hi] - times[lo]) }
}
export function nearestTimeIndex(times: readonly number[], tMs: number): number {
  const { a, b, mix } = bracketTime(times, tMs)
  return mix < 0.5 ? a : b
}
export function validateTimes(times: readonly number[], count: number): void {
  if (times.length !== count || !count) throw new Error('Frame timestamps do not match field data')
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(times[i]) || (i > 0 && times[i] <= times[i - 1])) throw new Error('Acquisition timestamps must be finite and strictly increasing')
  }
}
