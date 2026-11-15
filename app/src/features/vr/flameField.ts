import { validateTimes } from './flameTime.ts'

/** Shared linear emission grid. Never normalized per frame. */
export const LUT_Z = 128
export const LUT_R = 64
export interface FlameFrame { index: number; tMs: number; data: Uint16Array }
export interface FlameGeometry {
  domainMeters: number; burnerRadiusMeters: number
  scaleStatus: 'estimated' | 'calibrated'; scaleRelativeUncertainty?: number
  centerPixels?: [number, number]; domainRadiusPixels?: number; pixelSizeMeters?: number; scaleSource?: string
}
export interface FlameSequence { frames: FlameFrame[]; fps: number; kind: 'real' | 'physics'; geometry: FlameGeometry }
export interface LutMetadata {
  schemaVersion: 2; dataset: string; testpoint: string; camera: string; method: string
  file: string; encoding: 'float16-le'; compression: 'gzip'; frames: number; z: number; r: number; fps: number
  timesMs: number[]; timeOrigin: string; durationMs: number; ignitionMs: number; extinctionMs: number
  flowOnMs?: number; flowOffMs?: number; geometry: FlameGeometry
  radiometry: { displayCounts: number; absoluteCalibration: boolean; perFrameNormalization: boolean }
  validation: { medianProjectionNrmse: number | null; framesCompared: number; maskedValuesAreInferred: boolean }
  quality: { saturatedFraction: number; observedFraction: number; projectionNrmse?: number | null; inferredFromPrior?: boolean }[]
}
const scratchFloat = new Float32Array(1)
const scratchBits = new Uint32Array(scratchFloat.buffer)
/** Positive finite binary16 conversion, independent of renderer APIs. */
export function toHalf(value: number): number {
  scratchFloat[0] = Math.max(0, Math.min(65504, Number.isFinite(value) ? value : 0))
  const bits = scratchBits[0]
  const exponent = ((bits >>> 23) & 255) - 127 + 15
  const mantissa = bits & 0x7fffff
  if (exponent <= 0) {
    if (exponent < -10) return 0
    return ((mantissa | 0x800000) + (1 << (13 - exponent))) >>> (14 - exponent)
  }
  return Math.min(0x7bff, (exponent << 10) + ((mantissa + 0x1000) >>> 13))
}
export function fromHalf(value: number): number {
  const exponent = (value >>> 10) & 31
  const fraction = value & 1023
  return exponent === 0 ? fraction * 2 ** -24 : (1 + fraction / 1024) * 2 ** (exponent - 15)
}
export const DEFAULT_GEOMETRY: FlameGeometry = {
  domainMeters: 0.07408333333333333, burnerRadiusMeters: 0.003175,
  scaleStatus: 'estimated', scaleRelativeUncertainty: 0.25,
}
export function emptySequence(): FlameSequence {
  return { frames: [{ index: 0, tMs: 0, data: new Uint16Array(LUT_Z * LUT_R) }], fps: 0, kind: 'physics', geometry: DEFAULT_GEOMETRY }
}

export function decodeLut(buffer: ArrayBuffer, meta: LutMetadata): FlameSequence {
  if (meta.schemaVersion !== 2 || meta.encoding !== 'float16-le' || meta.z !== LUT_Z || meta.r !== LUT_R) throw new Error('Unsupported flame format; rebuild the INTNS data')
  validateTimes(meta.timesMs, meta.frames)
  if (!(meta.geometry.domainMeters > meta.geometry.burnerRadiusMeters * 2 && meta.geometry.burnerRadiusMeters > 0)) throw new Error('Invalid physical geometry')
  if (buffer.byteLength !== meta.frames * LUT_Z * LUT_R * 2) throw new Error('Incomplete flame field download')
  const values = new Uint16Array(buffer)
  for (const value of values) if (value >= 0x7c00) throw new Error('Non-finite or negative emission')
  const perFrame = LUT_Z * LUT_R
  return {
    kind: 'real', geometry: meta.geometry, fps: meta.fps,
    frames: meta.timesMs.map((tMs, index) => ({ index, tMs, data: values.subarray(index * perFrame, (index + 1) * perFrame) })),
  }
}
