import type { SensorSeries } from './flameEngine'
import { nearestTimeIndex } from './flameTime'

const ink = '#0e1520', edge = '#29374a', text = '#e9eef5', muted = '#9daec3', blue = '#4da3ff'
const sans = '"Space Grotesk Variable", sans-serif'
const mono = '"IBM Plex Mono", monospace'
const seriesColors = ['#67b2ff', '#ffbd69', '#55d9b2', '#ff8b8b', '#b3d969']

function surface(ctx: CanvasRenderingContext2D, w: number, h: number, fill = ink, stroke = edge, radius = 20) {
  ctx.clearRect(0, 0, w, h)
  ctx.beginPath()
  ctx.roundRect(2, 2, w - 4, h - 4, radius)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.stroke()
}

export type PlayerIcon = 'play' | 'pause' | 'rewind' | 'previous' | 'next' | 'restart' | 'smaller' | 'larger' | 'reset' | 'left' | 'right'

function icon(ctx: CanvasRenderingContext2D, kind: PlayerIcon, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x - size / 2, y - size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const line = (...points: number[]) => {
    ctx.beginPath(); ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
    ctx.stroke()
  }
  const triangle = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill()
  }
  switch (kind) {
    case 'play': triangle(8, 4, 20, 12, 8, 20); break
    case 'pause': ctx.fillRect(6, 4, 4, 16); ctx.fillRect(14, 4, 4, 16); break
    case 'rewind': triangle(11, 5, 2, 12, 11, 19); triangle(22, 5, 13, 12, 22, 19); break
    case 'previous': line(5, 5, 5, 19); triangle(18, 5, 8, 12, 18, 19); break
    case 'next': line(19, 5, 19, 19); triangle(6, 5, 16, 12, 6, 19); break
    case 'left': line(15, 5, 8, 12, 15, 19); break
    case 'right': line(9, 5, 16, 12, 9, 19); break
    case 'smaller': case 'larger':
      ctx.beginPath(); ctx.arc(10, 10, 7, 0, Math.PI * 2); ctx.stroke()
      line(15, 15, 21, 21); line(7, 10, 13, 10)
      if (kind === 'larger') line(10, 7, 10, 13)
      break
    case 'restart':
      ctx.beginPath(); ctx.arc(12, 12, 8, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke()
      line(3, 3, 3, 9, 9, 9)
      break
    case 'reset':
      line(9, 3, 3, 3, 3, 9); line(15, 3, 21, 3, 21, 9)
      line(3, 15, 3, 21, 9, 21); line(15, 21, 21, 21, 21, 15)
      break
  }
  ctx.restore()
}

export function drawPlayerButton(canvas: HTMLCanvasElement, label: string, kind: PlayerIcon, primary: boolean, active: boolean, hovered: boolean, disabled = false) {
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.globalAlpha = disabled ? 0.4 : 1
  const w = canvas.width, h = canvas.height
  const foreground = primary ? '#061225' : text
  surface(ctx, w, h, primary ? hovered ? '#79bdff' : blue : hovered ? '#223b58' : active ? '#183653' : '#172231', hovered || active ? blue : primary ? '#71b7ff' : edge, 22)
  ctx.strokeStyle = foreground
  ctx.fillStyle = foreground
  icon(ctx, kind, w / 2, h * 0.36, h * 0.3)
  ctx.textAlign = 'center'
  ctx.font = `600 ${primary ? 30 : 26}px ${sans}`
  ctx.fillText(label, w / 2, h * 0.84, w - 20)
  ctx.restore()
}

export function drawPlaybackHeading(canvas: HTMLCanvasElement, id: string, info: string, playing: boolean, direction: number, frame: number, total: number, statusOverride?: string) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.textAlign = 'left'
  ctx.fillStyle = muted; ctx.font = `500 21px ${sans}`
  ctx.fillText('EXPERIMENT', 32, 30)
  ctx.fillStyle = text; ctx.font = `600 45px ${sans}`
  ctx.fillText(id || 'Loading…', 30, 82)
  ctx.fillStyle = muted; ctx.font = `24px ${sans}`
  ctx.fillText(info || 'INTNS / spherical transport', 32, h - 17, w - 64)
  const status = statusOverride || (playing ? direction === -1 ? 'REWINDING' : 'PLAYING' : 'PAUSED')
  ctx.beginPath(); ctx.roundRect(w - 234, 10, 202, 42, 21)
  ctx.fillStyle = playing ? '#183653' : '#1a2534'; ctx.fill()
  ctx.fillStyle = playing ? blue : muted; ctx.textAlign = 'center'; ctx.font = `600 21px ${sans}`
  ctx.fillText(status, w - 133, 38)
  ctx.textAlign = 'right'; ctx.fillStyle = muted; ctx.font = `20px ${mono}`
  ctx.fillText(`FRAME ${total ? frame + 1 : 0} / ${total}`, w - 32, 82)
  ctx.textAlign = 'left'
}

// The visual track and hand hit mapping share the same insets.
export const TIMELINE_INSET = 0.035
export function timelineFraction(u: number) { return Math.max(0, Math.min(1, (u - TIMELINE_INSET) / (1 - TIMELINE_INSET * 2))) }

export function drawPlaybackTimeline(canvas: HTMLCanvasElement, timeMs: number, startMs: number, endMs: number, hovered: boolean, scrubbing: boolean) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height, inset = w * TIMELINE_INSET
  const fraction = Math.max(0, Math.min(1, (timeMs - startMs) / Math.max(1, endMs - startMs)))
  surface(ctx, w, h, hovered || scrubbing ? '#17283c' : '#101b29', hovered || scrubbing ? blue : '#202f42', 16)
  ctx.fillStyle = text; ctx.font = `500 32px ${mono}`; ctx.textAlign = 'left'
  ctx.fillText(`${(timeMs / 1000).toFixed(2)} s`, inset, 44)
  ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.font = `24px ${mono}`
  ctx.fillText(`/ ${(endMs / 1000).toFixed(2)} s`, w - inset, 44)
  ctx.textAlign = 'center'; ctx.font = `22px ${sans}`
  ctx.fillText(scrubbing ? 'Release to set time' : 'Pinch and drag to seek', w / 2, 42)
  const y = 77, width = w - inset * 2
  ctx.lineCap = 'round'; ctx.lineWidth = 10
  ctx.strokeStyle = '#34455c'; ctx.beginPath(); ctx.moveTo(inset, y); ctx.lineTo(w - inset, y); ctx.stroke()
  ctx.strokeStyle = blue; ctx.beginPath(); ctx.moveTo(inset, y); ctx.lineTo(inset + width * fraction, y); ctx.stroke()
  ctx.fillStyle = text; ctx.beginPath(); ctx.arc(inset + width * fraction, y, scrubbing ? 13 : 10, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = muted; ctx.font = `18px ${mono}`
  for (let i = 0; i <= 4; i++) {
    ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'
    ctx.fillText(`${((startMs + (endMs - startMs) * i / 4) / 1000).toFixed(0)}s`, inset + width * i / 4, h - 12)
  }
}

export function drawPlaybackSurface(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  surface(ctx, canvas.width, canvas.height, ink, edge, 28)
  ctx.strokeStyle = '#223044'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(32, 458); ctx.lineTo(canvas.width - 32, 458); ctx.stroke()
  ctx.fillStyle = muted; ctx.font = `20px ${sans}`
  ctx.textAlign = 'left'; ctx.fillText('FLAME', 40, 486)
  ctx.textAlign = 'right'; ctx.fillText('EXPERIMENT', canvas.width - 40, 486)
  ctx.textAlign = 'center'; ctx.fillStyle = '#8194ad'; ctx.font = `20px ${sans}`
  ctx.fillText('Pinch to interact · Grab the experiment title to move this panel', canvas.width / 2, canvas.height - 22)
}

export interface ExperimentOption { id: string; label: string; summary: string; detail: string }

export function drawExperimentCard(canvas: HTMLCanvasElement, experiment: ExperimentOption, selected: boolean, hovered: boolean) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height
  surface(ctx, w, h, selected ? '#173653' : hovered ? '#223b58' : '#172231', selected || hovered ? blue : edge, 18)
  ctx.textAlign = 'left'; ctx.fillStyle = text; ctx.font = `600 32px ${sans}`
  ctx.fillText(experiment.label, 26, 43, w - 220)
  ctx.fillStyle = muted; ctx.font = `24px ${sans}`
  ctx.fillText(experiment.summary, 26, 83, w - 52)
  ctx.fillStyle = '#8194ad'; ctx.font = `20px ${sans}`
  ctx.fillText(experiment.detail, 26, h - 19, w - 52)
  ctx.textAlign = 'right'; ctx.fillStyle = selected ? blue : muted; ctx.font = `600 22px ${sans}`
  ctx.fillText(selected ? 'CURRENT' : 'SELECT →', w - 26, 42)
}

export function formatSignal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0.000'
  if (Math.abs(value) < 0.001) return value.toExponential(2)
  return value.toFixed(Math.abs(value) < 0.1 ? 5 : Math.abs(value) < 1 ? 4 : 3)
}

const channelNames: Record<string, string> = { TCBurner: 'Burner', TCA: 'Thermocouple A', TCB: 'Thermocouple B', MFCA3FuelFlow: 'Fuel flow', IonCurrent: 'Ion current' }

export function drawSensorPanel(canvas: HTMLCanvasElement, title: string, experiment: string, series: SensorSeries[], times: number[], playhead: number) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height
  surface(ctx, w, h)
  ctx.textAlign = 'left'; ctx.fillStyle = muted; ctx.font = `20px ${sans}`
  ctx.fillText('SENSOR TELEMETRY', 30, 36)
  ctx.textAlign = 'right'; ctx.font = `20px ${mono}`; ctx.fillText(experiment, w - 30, 36)
  ctx.textAlign = 'left'; ctx.fillStyle = text; ctx.font = `600 34px ${sans}`; ctx.fillText(title, 30, 81)
  ctx.textAlign = 'right'; ctx.fillStyle = blue; ctx.font = `24px ${mono}`; ctx.fillText(`${playhead.toFixed(2)} s`, w - 30, 80)
  ctx.textAlign = 'left'; ctx.fillStyle = muted; ctx.font = `19px ${sans}`
  ctx.fillText('Raw signals · each channel has its own scale', 30, 114)
  if (!times.length || !series.length) return
  const top = 140, bottom = h - 78, rowHeight = (bottom - top) / series.length
  const left = 138, right = w - 35, width = right - left
  const tmin = times[0], tmax = times.at(-1)!, span = Math.max(1e-9, tmax - tmin)
  const sx = (t: number) => left + (t - tmin) / span * width
  const sample = nearestTimeIndex(times, playhead)
  const ticks = Array.from({ length: 6 }, (_, i) => tmin + span * i / 5)
  series.forEach((channel, row) => {
    const color = seriesColors[row % seriesColors.length], y = top + row * rowHeight
    const plotTop = y + 48, plotBottom = y + rowHeight - 18
    const rawRange = Math.max(1e-12, channel.max - channel.min)
    const lo = channel.min - rawRange * 0.05, hi = channel.max + rawRange * 0.05
    const sy = (v: number) => plotBottom - (v - lo) / (hi - lo) * (plotBottom - plotTop)
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(37, y + 19, 5, 0, Math.PI * 2); ctx.fill()
    ctx.textAlign = 'left'; ctx.fillStyle = text; ctx.font = `500 24px ${sans}`
    ctx.fillText(channelNames[channel.name] || channel.name, 53, y + 27)
    ctx.fillStyle = muted; ctx.font = `18px ${mono}`
    const labelEnd = 53 + ctx.measureText(channelNames[channel.name] || channel.name).width
    if (channelNames[channel.name]) ctx.fillText(channel.name, Math.max(300, labelEnd + 35), y + 27)
    ctx.textAlign = 'right'; ctx.fillStyle = color; ctx.font = `500 25px ${mono}`
    ctx.fillText(formatSignal(channel.v[sample]), right, y + 27)
    ctx.font = `17px ${mono}`; ctx.fillStyle = '#95a7bd'
    ctx.fillText(formatSignal(hi), left - 17, plotTop + 6)
    ctx.fillText(formatSignal(lo), left - 17, plotBottom + 5)
    ctx.strokeStyle = '#263345'; ctx.lineWidth = 1
    for (const tick of ticks) {
      const x = sx(tick); ctx.beginPath(); ctx.moveTo(x, plotTop); ctx.lineTo(x, plotBottom); ctx.stroke()
    }
    for (const yy of [plotTop, plotBottom]) {
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke()
    }
    ctx.save(); ctx.beginPath(); ctx.rect(left, plotTop - 3, width, plotBottom - plotTop + 6); ctx.clip()
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath()
    let started = false
    for (let i = 0; i < times.length; i++) {
      const value = channel.v[i]
      if (value == null || !Number.isFinite(value)) { started = false; continue }
      const x = sx(times[i]), yy = sy(value)
      if (!started) { ctx.moveTo(x, yy); started = true } else ctx.lineTo(x, yy)
    }
    ctx.stroke()
    if (playhead >= tmin && playhead <= tmax) {
      const x = sx(playhead)
      ctx.strokeStyle = '#a8c8ec'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, plotTop); ctx.lineTo(x, plotBottom); ctx.stroke()
      const value = channel.v[sample]
      if (value != null && Number.isFinite(value)) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(times[sample]), sy(value), 5, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.restore()
  })
  ctx.fillStyle = muted; ctx.font = `19px ${mono}`
  for (let i = 0; i < ticks.length; i++) {
    ctx.textAlign = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center'
    ctx.fillText(`${ticks[i].toFixed(0)}s`, sx(ticks[i]), h - 48)
  }
  ctx.textAlign = 'left'; ctx.font = `18px ${sans}`; ctx.fillStyle = '#8194ad'
  ctx.fillText('Time from first camera exposure · uncalibrated signals', 30, h - 17)
}
